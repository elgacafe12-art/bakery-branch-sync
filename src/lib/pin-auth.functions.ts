import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { AppRole } from "./roles";

const VALID_ROLES: AppRole[] = ["admin", "central_store", "central_bakery", "delivery_man", "branch_1", "branch_2"];

function createAnonClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export const signInWithPin = createServerFn({ method: "POST" })
  .inputValidator((data: { pin: string }) => {
    if (!data || typeof data.pin !== "string" || !/^\d{4}$/.test(data.pin)) {
      throw new Error("Invalid PIN");
    }
    return { pin: data.pin };
  })
  .handler(async ({ data }) => {
    const anon = createAnonClient();
    // Verify PIN against portal_pins (fails closed on any RPC error — no
    // hardcoded default-PIN fallback).
    const { data: role, error: lookupErr } = await anon.rpc("verify_portal_pin", {
      _pin: data.pin,
    });
    if (lookupErr || !role) throw new Error("Invalid PIN");

    const { PORTAL_ACCOUNTS } = await import("./pin-auth.server");
    const cred = PORTAL_ACCOUNTS[role as AppRole];
    if (!cred) throw new Error("Invalid PIN");

    // Mint a one-time magic-link token via Admin API, then exchange it for a
    // session using the anon client. No shared portal passwords required.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: link, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: cred.email,
    });
    if (linkErr || !link?.properties?.hashed_token) {
      throw new Error("Portal account not available. Contact the administrator.");
    }

    const { data: verified, error: verifyErr } = await anon.auth.verifyOtp({
      type: "magiclink",
      token_hash: link.properties.hashed_token,
    });
    if (verifyErr || !verified.session) {
      throw new Error("Portal account not available. Contact the administrator.");
    }

    return {
      label: cred.label,
      access_token: verified.session.access_token,
      refresh_token: verified.session.refresh_token,
    };
  });

export const setPortalPin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { role: AppRole; pin: string }) => {
    if (!data || !VALID_ROLES.includes(data.role)) throw new Error("Invalid role");
    if (typeof data.pin !== "string" || !/^\d{4}$/.test(data.pin)) throw new Error("PIN must be 4 digits");
    return { role: data.role, pin: data.pin };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: adminRow, error: adminErr } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (adminErr) throw new Error(adminErr.message);
    if (!adminRow) throw new Error("Forbidden");

    const { data: existing } = await supabase
      .from("portal_pins")
      .select("role")
      .eq("pin", data.pin)
      .maybeSingle();
    if (existing && existing.role !== data.role) {
      throw new Error(`PIN already used by ${existing.role}`);
    }

    const { error } = await supabase
      .from("portal_pins")
      .upsert({ role: data.role, pin: data.pin, updated_by: userId, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
