self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "FZAC Materiales", body: "Nueva notificación administrativa." };
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || "FZAC Materiales", {
      body: payload.body || "Nueva notificación administrativa.",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: payload.tag || "fzac-admin-notification",
      renotify: true,
      data: { url: payload.url || "/fzac-admin-crs-2026" }
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/fzac-admin-crs-2026", self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if ("focus" in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return clients.openWindow ? clients.openWindow(target) : undefined;
    })
  );
});
