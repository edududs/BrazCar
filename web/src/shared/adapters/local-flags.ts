/**
 * Per-device flags in localStorage, for conveniences only (a hint already dismissed). Storage can be
 * missing or throw (private mode, blocked site data), and then the flag simply reads as unset.
 */
const PREFIX = "brazcar:";

export function readFlag(name: string): boolean {
  try {
    return window.localStorage.getItem(PREFIX + name) === "1";
  } catch {
    return false;
  }
}

export function writeFlag(name: string): void {
  try {
    window.localStorage.setItem(PREFIX + name, "1");
  } catch {
    // Not remembered: the hint comes back next time, which is harmless.
  }
}
