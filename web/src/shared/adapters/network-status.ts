import type { NetworkStatus } from "../domain/app-shell";

/** The only place that asks the browser whether there is a network (D-051). */
export function readNetworkStatus(): NetworkStatus {
  return navigator.onLine ? "online" : "offline";
}

export function subscribeToNetworkStatus(onChange: () => void): () => void {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}
