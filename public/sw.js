self.addEventListener("push", (event) => {
  event.waitUntil(
    self.registration.showNotification("RentKeep renewal reminder", {
      body: "Open RentKeep to review an upcoming renewal.",
      icon: "/icon-192.png",
      tag: "rentkeep-renewal",
    }),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(self.location.origin + "/"));
});
