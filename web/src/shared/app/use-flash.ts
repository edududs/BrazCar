import { useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import type { Flash } from "../domain/flash";

/** How long a flash stays on screen before leaving by itself (F5). */
const FLASH_MS = 4000;

/**
 * The flash the current history entry carries, for a while: it shows when the entry is entered
 * and goes away on its own. An entry whose flash has run out does not show it again.
 */
export function useFlash(flashMs = FLASH_MS): Flash | null {
  const carried = useRouterState({ select: (state) => state.location.state.flash ?? null });
  const entry = useRouterState({ select: (state) => state.location.state.key ?? "" });
  const [expired, setExpired] = useState<string | null>(null);

  useEffect(() => {
    if (carried === null) return;
    const timer = window.setTimeout(() => {
      setExpired(entry);
    }, flashMs);
    return () => {
      window.clearTimeout(timer);
    };
  }, [carried, entry, flashMs]);

  return carried !== null && expired !== entry ? carried : null;
}
