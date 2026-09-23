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
 * Follows the board's revision (ADR-0010) and calls `onChange` after a random delay when it moves.
 *
 * - The first number of a connection is where the board stands. It only counts as a change when it
 *   differs from the last one seen, so a reconnect after missed writes refreshes and one after
 *   nothing does not. The stream's opening frame is the revision check: no separate request (D-104).
 * - While a fetch is waiting for its delay, newer numbers join it instead of scheduling another:
 *   the burst iOS delivers on wake is one signal, whatever the random delay drew (D-077).
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
      if (!changed || timer !== undefined) return;
      timer = window.setTimeout(
        () => {
          timer = undefined;
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
