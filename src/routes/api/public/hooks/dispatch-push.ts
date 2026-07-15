import { createFileRoute } from "@tanstack/react-router";
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "node:crypto";
import type { Database } from "@/integrations/supabase/types";

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export const Route = createFileRoute("/api/public/hooks/dispatch-push")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = process.env.SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const vapidPublic = process.env.VAPID_PUBLIC_KEY;
        const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
        const vapidSubject = process.env.VAPID_SUBJECT || "mailto:admin@example.com";

        if (!url || !serviceKey || !vapidPublic || !vapidPrivate) {
          return new Response(JSON.stringify({ error: "unavailable" }), { status: 503 });
        }

        const admin = createClient<Database>(url, serviceKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });

        // Fetch the expected shared secret from Supabase Vault (rotated
        // server-side; never embedded in migrations or env files).
        const { data: secretRow, error: secretErr } = await admin
          .schema("vault" as never)
          .from("decrypted_secrets" as never)
          .select("decrypted_secret")
          .eq("name", "push_dispatch_secret")
          .maybeSingle();
        const expectedSecret = (secretRow as { decrypted_secret?: string } | null)?.decrypted_secret;
        if (secretErr || !expectedSecret) {
          return new Response(JSON.stringify({ error: "unavailable" }), { status: 503 });
        }

        // Require the shared cron secret. Anonymous callers are rejected
        // before any privileged service-role work runs.
        const provided =
          request.headers.get("x-dispatch-secret") ||
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
          "";
        if (!provided || !safeEqual(provided, expectedSecret)) {
          return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
        }

        webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);


        const cutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();
        const { data: notifs, error } = await admin
          .from("notifications")
          .select("*")
          .is("pushed_at", null)
          .gte("created_at", cutoff)
          .not("user_id", "is", null)
          .order("created_at", { ascending: true })
          .limit(200);

        if (error) {
          console.error("dispatch-push notifications query failed", error);
          return new Response(JSON.stringify({ error: "internal_error" }), { status: 500 });
        }
        if (!notifs?.length) return new Response(JSON.stringify({ pushed: 0 }), { headers: { "Content-Type": "application/json" } });

        const userIds = Array.from(new Set(notifs.map((n) => n.user_id).filter(Boolean))) as string[];
        const { data: subs } = await admin
          .from("push_subscriptions")
          .select("*")
          .in("user_id", userIds);

        const byUser = new Map<string, typeof subs>();
        for (const s of subs ?? []) {
          const arr = byUser.get(s.user_id) ?? [];
          arr.push(s);
          byUser.set(s.user_id, arr);
        }

        const { data: prefs } = await admin
          .from("notification_settings")
          .select("user_id,push_enabled")
          .in("user_id", userIds);
        const pushDisabled = new Set((prefs ?? []).filter((p) => !p.push_enabled).map((p) => p.user_id));

        const staleEndpoints: string[] = [];
        let pushed = 0;

        for (const n of notifs) {
          if (!n.user_id) continue;
          if (pushDisabled.has(n.user_id)) continue;
          const userSubs = byUser.get(n.user_id) ?? [];
          const payload = JSON.stringify({
            id: n.id,
            title: n.title,
            message: n.message,
            link: n.link,
            priority: n.priority,
            timestamp: n.created_at,
            tag: n.id,
          });
          for (const s of userSubs) {
            try {
              await webpush.sendNotification(
                { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
                payload,
                { TTL: 60 * 60 * 24 }
              );
              pushed++;
            } catch (err: unknown) {
              const status = (err as { statusCode?: number })?.statusCode;
              if (status === 404 || status === 410) staleEndpoints.push(s.endpoint);
              else console.warn("push error", err);
            }
          }
        }

        await admin
          .from("notifications")
          .update({ pushed_at: new Date().toISOString() })
          .in("id", notifs.map((n) => n.id));

        if (staleEndpoints.length) {
          await admin.from("push_subscriptions").delete().in("endpoint", staleEndpoints);
        }

        return new Response(JSON.stringify({ pushed, stale: staleEndpoints.length }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
