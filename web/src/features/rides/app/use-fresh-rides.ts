import { useEffect, useRef, useState } from "react";

import type { Ride } from "../domain/ride";

/** How long a ride that just arrived wears its "Nova" badge (F5). */
const FRESH_MS = 6000;

interface FreshRidesOptions {
  readonly freshMs?: number;
  /** Only a list the API has answered counts as a baseline: while loading, nothing is fresh. */
  readonly ready?: boolean;
}

/**
 * Which rides of the list were not in the previous list: the ones that arrived through the
 * revision signal while the person was looking (ADR-0010). The first list is never fresh, a ride
 * stops being fresh after a while, and a list that only lost rides marks nothing.
 */
export function useFreshRides(
  rides: readonly Ride[],
  { freshMs = FRESH_MS, ready = true }: FreshRidesOptions = {},
): ReadonlySet<string> {
  const known = useRef<ReadonlySet<string> | null>(null);
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    if (!ready) return;
    const ids = new Set(rides.map((ride) => ride.id));
    const previous = known.current;
    known.current = ids;
    if (previous === null) return;
    const arrived = [...ids].filter((id) => !previous.has(id));
    if (arrived.length === 0) return;
    setFresh((current) => new Set([...current, ...arrived]));
    const timer = window.setTimeout(() => {
      setFresh((current) => new Set([...current].filter((id) => !arrived.includes(id))));
    }, freshMs);
    return () => {
      window.clearTimeout(timer);
    };
  }, [rides, freshMs, ready]);

  return fresh;
}
