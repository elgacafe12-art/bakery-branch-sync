import { supabase } from "@/integrations/supabase/client";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) output[i] = raw.charCodeAt(i);
  return output;
}

export function isPushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;
    // Hand the VAPID key to the SW so it can auto-resubscribe on rotation.
    if (VAPID_PUBLIC_KEY && reg.active) {
      try { reg.active.postMessage({ type: "set-vapid-key", key: VAPID_PUBLIC_KEY }); } catch { /* ignore */ }
    }
    return reg;
  } catch (e) {
    console.warn("SW registration failed", e);
    return null;
  }
}

async function persistSubscription(userId: string, sub: PushSubscription): Promise<void> {
  const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return;
  await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      user_agent: navigator.userAgent,
    },
    { onConflict: "endpoint" }
  );
}

export async function subscribeToPush(userId: string): Promise<PushSubscription | null> {
  if (!isPushSupported() || !VAPID_PUBLIC_KEY) return null;
  const reg = await registerServiceWorker();
  if (!reg) return null;
  let sub = await reg.pushManager.getSubscription();
  // Detect invalid/expired subscriptions and recreate them.
  if (sub && (sub as PushSubscription & { expirationTime?: number | null }).expirationTime && (sub as PushSubscription & { expirationTime?: number | null }).expirationTime! < Date.now()) {
    try {
      const oldEndpoint = sub.endpoint;
      await sub.unsubscribe().catch(() => {});
      await supabase.from("push_subscriptions").delete().eq("endpoint", oldEndpoint);
    } catch { /* ignore */ }
    sub = null;
  }
  if (!sub) {
    try {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      });
    } catch (e) {
      console.warn("Push subscribe failed", e);
      return null;
    }
  }
  await persistSubscription(userId, sub);

  // Listen for SW-driven resubscribe (rotation) and persist the new endpoint.
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", async (ev) => {
      const data = (ev.data ?? {}) as { type?: string; subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } } };
      if (data.type === "push-subscription-changed" && data.subscription?.endpoint && data.subscription.keys?.p256dh && data.subscription.keys?.auth) {
        await supabase.from("push_subscriptions").upsert({
          user_id: userId,
          endpoint: data.subscription.endpoint,
          p256dh: data.subscription.keys.p256dh,
          auth: data.subscription.keys.auth,
          user_agent: navigator.userAgent,
        }, { onConflict: "endpoint" });
      }
    });
  }
  return sub;
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    const endpoint = sub.endpoint;
    await sub.unsubscribe().catch(() => {});
    await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  }
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) return "denied";
  if (Notification.permission === "default") {
    try { return await Notification.requestPermission(); } catch { return "denied"; }
  }
  return Notification.permission;
}
