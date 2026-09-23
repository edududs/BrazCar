import { useState, useSyncExternalStore } from "react";

import {
  applyUpdate,
  readUpdateWaiting,
  subscribeToUpdateWaiting,
} from "../adapters/service-worker";
import { useHasUnsavedWork } from "./unsaved-work";

export interface AppUpdate {
  /** A new build is installed and waiting for the user (D-052). */
  readonly available: boolean;
  /** Asks to switch. With unsaved work open it only raises `confirming`; nothing reloads yet. */
  readonly request: () => void;
  /** The user is being warned that switching discards what is being typed. */
  readonly confirming: boolean;
  readonly confirm: () => void;
  readonly cancel: () => void;
}

/** Headless prompt of a new build: never switches on its own, and never under an open form unasked. */
export function useAppUpdate(): AppUpdate {
  const available = useSyncExternalStore(subscribeToUpdateWaiting, readUpdateWaiting);
  const unsaved = useHasUnsavedWork();
  const [confirming, setConfirming] = useState(false);
  return {
    available,
    request: () => {
      if (unsaved) setConfirming(true);
      else void applyUpdate();
    },
    confirming,
    confirm: () => {
      setConfirming(false);
      void applyUpdate();
    },
    cancel: () => {
      setConfirming(false);
    },
  };
}
