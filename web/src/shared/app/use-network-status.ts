import { useSyncExternalStore } from "react";

import { readNetworkStatus, subscribeToNetworkStatus } from "../adapters/network-status";
import type { NetworkStatus } from "../domain/app-shell";

/** Online or not, as the browser says, re-rendering on every change (D-051). */
export function useNetworkStatus(): NetworkStatus {
  return useSyncExternalStore(subscribeToNetworkStatus, readNetworkStatus);
}
