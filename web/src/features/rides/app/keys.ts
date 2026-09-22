import type { BoardFilters } from "../domain/board";

/** Query keys of the feature, in one place so a write can invalidate exactly what it changed. */
export const rideKeys = {
  all: ["rides"] as const,
  board: (filters: BoardFilters) => ["rides", "board", filters] as const,
  boards: ["rides", "board"] as const,
  mine: ["rides", "mine"] as const,
  one: (rideId: string) => ["rides", "one", rideId] as const,
};
