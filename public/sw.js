/* ELGA Café notification service worker (Web Push) */
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
  const options = {
    body: payload.message || payload.body || "",
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    tag: payload.tag || payload.id || undefined,
    renotify: true,
    timestamp: payload.timestamp ? Date.parse(payload.timestamp) : Date.now(),
    data: { link: payload.link || "/notifications", id: payload.id },
    requireInteraction: payload.priority === "critical",
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.link) || "/notifications";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.focus();
          if ("navigate" in client) {
            try { client.navigate(target); } catch (_) {}
          }
          return;
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })
  );
});
