/*
 * Imported by the service worker that Workbox generates (`workbox.importScripts` in
 * vite.config.ts). Workbox only handles the precache (D-185); showing a push and opening the
 * app from its notification is this file's job.
 *
 * Plain script, no modules: it runs inside the service worker and is not part of the tsconfig.
 */

const DEFAULT_TITLE = "Apareceu carona";
const DEFAULT_BODY = "Toque para ver no BrazCar.";
const DEFAULT_TAG = "brazcar";
const DEFAULT_URL = "/";

/** A field counts only when it is a non-empty string; anything else takes the default. */
function textOr(value, fallback) {
  return typeof value === "string" && value !== "" ? value : fallback;
}

/** The push payload as an object; no data, broken JSON or a non-object all read as empty. */
function readPayload(event) {
  try {
    const payload = event.data ? event.data.json() : null;
    return typeof payload === "object" && payload !== null ? payload : {};
  } catch {
    return {};
  }
}

// Every push becomes a visible notification (`userVisibleOnly`, which iOS demands): this handler
// never returns without showing one.
self.addEventListener("push", (event) => {
  const payload = readPayload(event);
  event.waitUntil(
    self.registration.showNotification(textOr(payload.title, DEFAULT_TITLE), {
      body: textOr(payload.body, DEFAULT_BODY),
      tag: textOr(payload.tag, DEFAULT_TAG),
      icon: "/icon-192.png",
      data: { url: textOr(payload.url, DEFAULT_URL) },
    }),
  );
});

/** The address to open: the payload's path inside the app's scope, never another origin. */
function targetHref(notification) {
  const scope = new URL(self.registration.scope);
  const requested = notification.data && notification.data.url;
  try {
    const target = new URL(textOr(requested, DEFAULT_URL), scope);
    if (target.origin === scope.origin) return target.href;
  } catch {
    // Falls through to the root below.
  }
  return new URL(DEFAULT_URL, scope).href;
}

async function openTarget(href) {
  const origin = new URL(href).origin;
  const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  const open = windows.find((client) => new URL(client.url).origin === origin);
  if (open === undefined) return self.clients.openWindow(href);
  try {
    await open.focus();
    return await open.navigate(href);
  } catch {
    // A window the worker does not control cannot be navigated: open a new one instead.
    return self.clients.openWindow(href);
  }
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(openTarget(targetHref(event.notification)));
});
