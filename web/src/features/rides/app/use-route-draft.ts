import { useRef, useState } from "react";

import type { StopDraft } from "../domain/ride";

/** Where a stop sits in the route. The first is where the ride leaves, the last where it goes. */
export type StopRole = "origin" | "waypoint" | "destination";

export interface RouteDraftStop {
  /** Stable across inserts and removals, for the screen's keys. */
  readonly key: number;
  readonly role: StopRole;
  readonly stop: StopDraft;
}

export interface RouteDraft {
  readonly stops: readonly RouteDraftStop[];
  readonly change: (key: number, stop: StopDraft) => void;
  /** A stop on the way: always right before the destination. */
  readonly addWaypoint: () => void;
  /** Only waypoints go; origin and destination are the least a ride has (D-013). */
  readonly remove: (key: number) => void;
  readonly value: () => StopDraft[];
}

interface Entry {
  readonly key: number;
  readonly stop: StopDraft;
}

const blank: StopDraft = { placeId: null, text: "" };

function roleAt(index: number, count: number): StopRole {
  if (index === 0) return "origin";
  return index === count - 1 ? "destination" : "waypoint";
}

/** Headless route editing: origin and destination, and any number of stops between them. */
export function useRouteDraft(initial: readonly StopDraft[]): RouteDraft {
  const nextKey = useRef(initial.length >= 2 ? initial.length : 2);
  const [entries, setEntries] = useState<readonly Entry[]>(() =>
    (initial.length >= 2 ? initial : [blank, blank]).map((stop, key) => ({ key, stop })),
  );

  return {
    stops: entries.map((entry, index) => ({ ...entry, role: roleAt(index, entries.length) })),
    change: (key, stop) => {
      setEntries((current) => current.map((entry) => (entry.key === key ? { key, stop } : entry)));
    },
    addWaypoint: () => {
      const added: Entry = { key: nextKey.current, stop: blank };
      nextKey.current += 1;
      setEntries((current) => [...current.slice(0, -1), added, ...current.slice(-1)]);
    },
    remove: (key) => {
      setEntries((current) =>
        current.filter(
          (entry, index) => entry.key !== key || roleAt(index, current.length) !== "waypoint",
        ),
      );
    },
    value: () => entries.map((entry) => entry.stop),
  };
}
