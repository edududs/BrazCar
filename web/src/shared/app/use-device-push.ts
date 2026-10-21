import { useCallback, useEffect, useRef, useState } from "react";

import { PushRequestError, type PushPermission } from "../domain/device-push";
import {
  deletePushSubscription,
  fetchPushPublicKey,
  savePushSubscription,
} from "../adapters/push-gateway";
import { readPushPermission, requestPushPermission } from "../adapters/web-notifications";
import {
  currentPushSubscription,
  subscribeToPush,
  unsubscribeFromPush,
} from "../adapters/web-push";

const UNAVAILABLE = "As notificações não estão disponíveis no momento.";
const ENABLE_FAILED = "Não foi possível ligar as notificações. Tente de novo.";
const DISABLE_FAILED = "Não foi possível desligar as notificações. Tente de novo.";

export interface DevicePush {
  /** What the browser allows on this device (the five states of `PushPermission`). */
  readonly permission: PushPermission;
  /** Whether this device holds a push subscription; null while it is still being read. Always false unless `permission` is "granted". */
  readonly subscribed: boolean | null;
  /** `enable` or `disable` running. */
  readonly pending: boolean;
  /** The sentence of the last failure, in pt-BR; cleared when an action starts. */
  readonly error: string | null;
  /** Call it straight from the tap handler: the permission prompt must be the first thing awaited. */
  readonly enable: () => Promise<void>;
  readonly disable: () => Promise<void>;
}

function messageOf(error: unknown, fallback: string): string {
  return error instanceof PushRequestError ? error.message : fallback;
}

/** Headless: turns notifications on and off for this device. Only adapters touch the platform. */
export function useDevicePush(): DevicePush {
  const [permission, setPermission] = useState<PushPermission>(() => readPushPermission());
  const [subscribed, setSubscribed] = useState<boolean | null>(
    permission === "granted" ? null : false,
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A ref, not the state: two taps in one tick both see the same render's `pending`.
  const running = useRef(false);

  useEffect(() => {
    if (permission !== "granted") return;
    let current = true;
    currentPushSubscription().then(
      (data) => {
        if (current) setSubscribed(data !== null);
      },
      () => {
        if (current) setSubscribed(false);
      },
    );
    return () => {
      current = false;
    };
    // Read once, on mount: `enable` and `disable` keep `subscribed` up to date afterwards.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const enable = useCallback(async (): Promise<void> => {
    if (running.current) return;
    if (permission === "unsupported" || permission === "needs-install" || permission === "denied") {
      return;
    }
    running.current = true;
    setPending(true);
    setError(null);
    try {
      const result = await requestPushPermission();
      setPermission(result);
      if (result !== "granted") {
        setSubscribed(false);
        return;
      }
      const key = await fetchPushPublicKey();
      if (key === null) {
        setError(UNAVAILABLE);
        return;
      }
      await savePushSubscription(await subscribeToPush(key));
      setSubscribed(true);
    } catch (failure) {
      setError(messageOf(failure, ENABLE_FAILED));
    } finally {
      running.current = false;
      setPending(false);
    }
  }, [permission]);

  const disable = useCallback(async (): Promise<void> => {
    if (running.current) return;
    running.current = true;
    setPending(true);
    setError(null);
    try {
      const endpoint = await unsubscribeFromPush();
      // The browser no longer delivers: whatever the API says, this device is off.
      setSubscribed(false);
      if (endpoint !== null) await deletePushSubscription(endpoint);
    } catch (failure) {
      setError(messageOf(failure, DISABLE_FAILED));
    } finally {
      running.current = false;
      setPending(false);
    }
  }, []);

  return { permission, subscribed, pending, error, enable, disable };
}
