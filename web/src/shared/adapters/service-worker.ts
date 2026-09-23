import { registerSW } from "virtual:pwa-register";

/**
 * The service worker, in prompt mode (D-052): a new build installs in the background and waits until
 * the user accepts it. Only the shell is precached (D-051). Nothing else in the app knows Workbox.
 */

/** How long a forced update waits for the new build to finish installing before plain reloading. */
const INSTALL_WAIT_MS = 10_000;

let activateWaiting: ((reloadPage: boolean) => Promise<void>) | null = null;
let registration: ServiceWorkerRegistration | undefined;
let waiting = false;
const listeners = new Set<() => void>();

const notify = () => {
  for (const listener of listeners) listener();
};

/** Starts the worker once, at boot. Off in development and where the browser has none. */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
  activateWaiting = registerSW({
    onNeedRefresh: () => {
      waiting = true;
      notify();
    },
    onRegisteredSW: (_url, registered) => {
      registration = registered;
    },
  });
  // An installed app is rarely navigated, and navigation is when browsers look for a new worker.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void registration?.update().catch(() => undefined);
  });
}

export function readUpdateWaiting(): boolean {
  return waiting;
}

export function subscribeToUpdateWaiting(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

function untilWaiting(timeoutMs: number): Promise<boolean> {
  if (waiting) return Promise.resolve(true);
  return new Promise((resolve) => {
    const stop = subscribeToUpdateWaiting(() => {
      window.clearTimeout(timer);
      stop();
      resolve(true);
    });
    const timer = window.setTimeout(() => {
      stop();
      resolve(false);
    }, timeoutMs);
  });
}

/**
 * Switches to the newest build and reloads. With a build already waiting it takes over at once;
 * otherwise (the version floor asked before the browser noticed) it looks for one first.
 */
export async function applyUpdate(): Promise<void> {
  if (activateWaiting !== null && !waiting) {
    await registration?.update().catch(() => undefined);
    await untilWaiting(INSTALL_WAIT_MS);
  }
  if (activateWaiting !== null && waiting) {
    await activateWaiting(true);
    return;
  }
  window.location.reload();
}
