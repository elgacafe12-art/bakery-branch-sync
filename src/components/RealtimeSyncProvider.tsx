import { useEffect, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Tables to watch for cross-user realtime sync. Notifications are handled
// separately by NotificationsProvider / NotificationBell.
const TABLES = [
  "inventory",
  "inventory_movements",
  "ingredients",
  "products",
  "suppliers",
  "supplier_deliveries",
  "supplier_delivery_items",
  "requests",
  "request_items",
  "productions",
  "production_ingredients",
  "damage_logs",
  "profiles",
  "user_roles",
  "portal_pins",
] as const;

export function RealtimeSyncProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();

  useEffect(() => {
    let pending = false;
    const invalidateAll = () => {
      if (pending) return;
      pending = true;
      // Coalesce bursts of change events into one invalidation pass.
      setTimeout(() => {
        pending = false;
        // Refetch everything the user is currently viewing. Inactive queries
        // are marked stale and will refetch on next mount.
        qc.invalidateQueries();
      }, 250);
    };

    const channel = supabase.channel("app-realtime-sync");
    for (const table of TABLES) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        invalidateAll,
      );
    }
    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  return <>{children}</>;
}
