export async function subscribeDevice(key, api) {
  if (!("serviceWorker" in navigator) || !("PushManager" in window))
    throw Error(
      "Push is unavailable in this browser. On iPhone, open the app from the Home Screen.",
    );
  if ((await Notification.requestPermission()) !== "granted")
    throw Error("Notification permission was not granted.");
  await navigator.serviceWorker.register("/sw.js");
  const reg = await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ||
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: Uint8Array.from(
        atob(key.replace(/-/g, "+").replace(/_/g, "/")),
        (c) => c.charCodeAt(0),
      ),
    }));
  await api("device", sub.toJSON());
}
