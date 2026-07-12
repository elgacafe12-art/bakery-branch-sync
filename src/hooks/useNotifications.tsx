import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Bell, AlertTriangle, PackageCheck, Truck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { playNotificationSound, primeAudio, type SoundPriority } from "@/lib/notifications/sound";
import { isPushSupported, requestNotificationPermission, subscribeToPush, unsubscribeFromPush } from "@/lib/notifications/push";
import { useNavigate } from "@tanstack/react-router";

export interface AppNotification {
  id: string;
  user_id: string | null;
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  type: string;
  priority: string;
  location: string | null;
  item_type: string | null;
  item_id: string | null;
  quantity: number | null;
  related_type: string | null;
  related_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface NotificationSettings {
  sound_enabled: boolean;
  push_enabled: boolean;
}

interface Ctx {
  settings: NotificationSettings;
  setSettings: (s: Partial<NotificationSettings>) => Promise<void>;
  permission: NotificationPermission;
  requestPermission: () => Promise<void>;
  pushSupported: boolean;
  pushSubscribed: boolean;
  enablePush: () => Promise<void>;
  disablePush: () => Promise<void>;
}

const NotificationsCtx = createContext<Ctx | null>(null);

function priorityToSound(p: string): SoundPriority {
  if (p === "critical") return "critical";
  if (p === "reminder") return "reminder";
  return "normal";
}

function iconFor(type: string) {
  if (type.startsWith("low_stock") || type === "out_of_stock" || type.startsWith("reminder") || type.startsWith("damage")) return AlertTriangle;
  if (type.includes("delivery") || type.includes("transfer")) return Truck;
  if (type.includes("stock") || type.includes("production") || type.includes("supplier")) return PackageCheck;
  return Bell;
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [settings, setSettingsState] = useState<NotificationSettings>({ sound_enabled: true, push_enabled: true });
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "denied"
  );
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const permissionRef = useRef(permission);
  permissionRef.current = permission;
  const seenIds = useRef<Set<string>>(new Set());

  // Load user settings
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("notification_settings").select("*").eq("user_id", user.id).maybeSingle();
      if (data) setSettingsState({ sound_enabled: data.sound_enabled, push_enabled: data.push_enabled });
    })();
  }, [user]);

  // Detect current push subscription & auto-subscribe when possible
  useEffect(() => {
    if (!user || !isPushSupported()) return;
    (async () => {
      const reg = await navigator.serviceWorker.getRegistration() ?? await (async () => {
        try { return await navigator.serviceWorker.register("/sw.js", { scope: "/" }); } catch { return null; }
      })();
      let sub = await reg?.pushManager.getSubscription();
      // If permission already granted and no active subscription, silently (re)subscribe
      if (!sub && typeof Notification !== "undefined" && Notification.permission === "granted") {
        sub = await subscribeToPush(user.id);
      } else if (sub) {
        // Ensure DB row exists for this subscription (idempotent)
        await subscribeToPush(user.id);
      }
      setPushSubscribed(!!sub);
    })();
  }, [user]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;
    primeAudio();
    const channel = supabase
      .channel(`notif-user-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const n = payload.new as AppNotification;
          if (seenIds.current.has(n.id)) return;
          seenIds.current.add(n.id);
          handleIncoming(n);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const handleIncoming = useCallback((n: AppNotification) => {
    const Icon = iconFor(n.type);
    const priority = n.priority || "normal";

    // Toast popup
    const description = [
      n.message,
      n.location ? `Location: ${n.location}` : null,
      n.quantity != null ? `Qty: ${n.quantity}` : null,
    ].filter(Boolean).join(" · ");

    const showToast = priority === "critical" ? toast.error : priority === "reminder" ? toast.warning : toast;
    showToast(n.title, {
      description,
      duration: priority === "critical" ? 10000 : 5000,
      icon: <Icon className="h-4 w-4" />,
      action: n.link ? {
        label: "Open",
        onClick: () => navigate({ to: n.link! }),
      } : undefined,
    });

    if (settingsRef.current.sound_enabled) {
      playNotificationSound(priorityToSound(priority));
    }

    // Browser system notification (fallback when tab is not focused)
    if (
      permissionRef.current === "granted" &&
      typeof document !== "undefined" &&
      document.visibilityState !== "visible"
    ) {
      try {
        const notif = new Notification(n.title, {
          body: description,
          icon: "/favicon.ico",
          badge: "/favicon.ico",
          tag: n.id,
          requireInteraction: priority === "critical",
        });
        notif.onclick = () => {
          window.focus();
          if (n.link) navigate({ to: n.link });
          notif.close();
        };
      } catch {
        /* ignore */
      }
    }
  }, [navigate]);

  const setSettings = useCallback(async (patch: Partial<NotificationSettings>) => {
    if (!user) return;
    const next = { ...settingsRef.current, ...patch };
    setSettingsState(next);
    await supabase.from("notification_settings").upsert({ user_id: user.id, ...next });
  }, [user]);

  const requestPermission = useCallback(async () => {
    const p = await requestNotificationPermission();
    setPermission(p);
  }, []);

  const enablePush = useCallback(async () => {
    if (!user) return;
    const p = await requestNotificationPermission();
    setPermission(p);
    if (p !== "granted") return;
    const sub = await subscribeToPush(user.id);
    setPushSubscribed(!!sub);
    await setSettings({ push_enabled: true });
  }, [user, setSettings]);

  const disablePush = useCallback(async () => {
    await unsubscribeFromPush();
    setPushSubscribed(false);
    await setSettings({ push_enabled: false });
  }, [setSettings]);

  return (
    <NotificationsCtx.Provider
      value={{
        settings,
        setSettings,
        permission,
        requestPermission,
        pushSupported: isPushSupported(),
        pushSubscribed,
        enablePush,
        disablePush,
      }}
    >
      {children}
    </NotificationsCtx.Provider>
  );
}

export function useNotificationsCtx() {
  const c = useContext(NotificationsCtx);
  if (!c) throw new Error("useNotificationsCtx must be used inside NotificationsProvider");
  return c;
}
