import type { Place } from "./place";

export type PlaceSearchStatus = "loading" | "ready" | "failed";

/** What a place picker needs to draw itself, whatever it looks like. */
export interface PlaceSearch {
  readonly query: string;
  readonly setQuery: (query: string) => void;
  /** Matches for the last answered query; kept on screen while the next one loads. */
  readonly places: readonly Place[];
  readonly status: PlaceSearchStatus;
}
