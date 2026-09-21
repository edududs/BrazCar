export type DisplayMode = "standalone" | "browser";

/** The only place that knows how to tell an installed app from a browser tab. */
export function detectDisplayMode(): DisplayMode {
  const iosStandalone = "standalone" in navigator && navigator.standalone === true;
  return iosStandalone || window.matchMedia("(display-mode: standalone)").matches
    ? "standalone"
    : "browser";
}
