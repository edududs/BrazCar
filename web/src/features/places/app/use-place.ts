import { useQuery } from "@tanstack/react-query";

import { fetchPlace } from "../adapters/places-gateway";
import type { Place } from "../domain/place";

const CATALOG_FRESH_MS = 5 * 60 * 1000;

/** The place behind an identifier that came from a URL: `null` while unknown or when there is none. */
export function usePlace(placeId: string | null): Place | null {
  const { data } = useQuery({
    queryKey: ["places", "one", placeId],
    queryFn: ({ signal }) =>
      placeId === null ? Promise.resolve(null) : fetchPlace(placeId, signal),
    staleTime: CATALOG_FRESH_MS,
  });
  return data ?? null;
}
