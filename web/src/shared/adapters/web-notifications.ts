import type { PushPermission } from "../domain/device-push";
import { detectDisplayMode, installsByHand } from "./display-mode";

/** The only place that knows `Notification`: what this device allows, in the app's own terms. */
export function readPushPermission(): PushPermission {
  const supported =
    "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
  if (!supported) {
    return installsByHand() && detectDisplayMode() === "browser" ? "needs-install" : "unsupported";
  }
  return Notification.permission;
}

/**
 * Asks the person, only when the browser has not been asked yet. This must be the first thing
 * awaited inside the tap: iOS shows the prompt only while the touch activation is still alive.
 */
export async function requestPushPermission(): Promise<PushPermission> {
  const current = readPushPermission();
  if (current !== "default") return current;
  await Notification.requestPermission();
  return readPushPermission();
}
