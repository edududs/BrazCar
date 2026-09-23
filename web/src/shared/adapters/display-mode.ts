import type { DisplayMode } from "../domain/app-shell";

/** The only place that knows how to tell an installed app from a browser tab. */
export function detectDisplayMode(): DisplayMode {
  const iosStandalone = "standalone" in navigator && navigator.standalone === true;
  return iosStandalone || window.matchMedia("(display-mode: standalone)").matches
    ? "standalone"
    : "browser";
}

/**
 * True on iPhone and iPad, where installing is a manual "Add to Home Screen" from the share sheet:
 * there is no install prompt to trigger. iPadOS reports itself as a Mac, hence the touch check.
 */
export function installsByHand(): boolean {
  const { userAgent, maxTouchPoints } = navigator;
  return (
    /iPhone|iPad|iPod/.test(userAgent) || (userAgent.includes("Macintosh") && maxTouchPoints > 1)
  );
}
