import { useEffect, useRef } from "react";

import { subscribeToBoardSignal } from "../adapters/board-signal-source";

/** Phones wait a random moment before fetching, so a change does not hit the API all at once (D-047). */
const MAX_SPREAD_MS = 2000;

interface BoardSignalOptions {
  readonly onChange: () => void;
  readonly maxSpreadMs?: number;
  readonly random?: () => number;
}

/**
 * Follows the board's revision (ADR-0010) and calls `onChange` once per new revision, after a random
 * delay. The first number after a connect is where the board is, not a change, unless it differs
 * from the last one seen: a reconnect after a change still refreshes.
 */
export function useBoardSignal({
  onChange,
  maxSpreadMs = MAX_SPREAD_MS,
  random = Math.random,
}: BoardSignalOptions): void {
  const latest = useRef(onChange);
  useEffect(() => {
    latest.current = onChange;
  });

  useEffect(() => {
    let known: number | null = null;
    let timer: number | undefined;
    const subscription = subscribeToBoardSignal((revision) => {
      const changed = known !== null && revision !== known;
      known = revision;
      if (!changed) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(
        () => {
          latest.current();
        },
        Math.floor(random() * maxSpreadMs),
      );
    });
    return () => {
      window.clearTimeout(timer);
      subscription.close();
    };
  }, [maxSpreadMs, random]);
}
