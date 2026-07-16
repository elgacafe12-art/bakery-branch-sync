/* ELGA Café notification service worker (Web Push) */
const VAPID_PUBLIC_KEY_CACHE = "vapid-public-key-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (_) {
    payload = { title: "Notification", body: event.data ? event.data.text() : "" };
  }
  const title = payload.title || "ELGA Café";
  const tag = payload.tag || payload.id || String(Date.now());
  const options = {
    body: payload.message || payload.body || "",
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    tag,
    renotify: true,
    timestamp: payload.timestamp ? Date.parse(payload.timestamp) : Date.now(),
    data: { link: payload.link || "/notifications", id: payload.id, tag },
    requireInteraction: payload.priority === "critical",
  };
  // Dedupe: if any client already showed a notification with this tag
  // (e.g. via in-app Notification API on a visible tab), skip the push one.
  event.waitUntil((async () => {
    try {
      const existing = await self.registration.getNotifications({ tag });
      if (existing && existing.length > 0) return;
    } catch (_) {}
    await self.registration.showNotification(title, options);
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.link) || "/notifications";
  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of allClients) {
      try {
        const clientUrl = new URL(client.url);
        if (clientUrl.origin === self.location.origin) {
          await client.focus();
          if ("navigate" in client) {
            try { await client.navigate(target); } catch (_) {}
          } else {
            client.postMessage({ type: "notif-navigate", link: target });
          }
          return;
        }
      } catch (_) {}
    }
    if (self.clients.openWindow) return self.clients.openWindow(target);
  })());
});

// Automatically resubscribe when the browser rotates the push subscription.
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(VAPID_PUBLIC_KEY_CACHE);
      const res = await cache.match("key");
      const vapidPublic = res ? await res.text() : null;
      if (!vapidPublic) return;
      const applicationServerKey = urlBase64ToUint8Array(vapidPublic);
      const newSub = await self.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });
      // Notify any open client so it can persist the new endpoint.
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const c of clients) {
        c.postMessage({ type: "push-subscription-changed", subscription: newSub.toJSON() });
      }
    } catch (e) {
      /* swallow; client will re-establish on next visit */
    }
  })());
});

// Allow the page to hand the VAPID key to the SW so we can resubscribe silently.
self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "set-vapid-key" && data.key) {
    event.waitUntil((async () => {
      const cache = await caches.open(VAPID_PUBLIC_KEY_CACHE);
      await cache.put("key", new Response(String(data.key)));
    })());
  }
});

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) output[i] = raw.charCodeAt(i);
  return output;
}
