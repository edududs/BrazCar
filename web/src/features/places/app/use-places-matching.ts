import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { searchPlaces } from "../adapters/places-gateway";
import type { Place } from "../domain/place";

const CATALOG_FRESH_MS = 5 * 60 * 1000; // the catalog changes a few times a year

/** Headless: the catalog places that answer an already-normalized text; none while it is empty. */
export function usePlacesMatching(key: string): readonly Place[] {
  const { data } = useQuery({
    queryKey: ["places", "search", key],
    queryFn: ({ signal }) => searchPlaces(key, signal),
    enabled: key !== "",
    placeholderData: keepPreviousData,
    staleTime: CATALOG_FRESH_MS,
  });
  return key === "" ? [] : (data ?? []);
}
