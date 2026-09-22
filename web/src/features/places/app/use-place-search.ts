import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useDebouncedValue } from "@/shared/app/use-debounced-value";

import { searchPlaces } from "../adapters/places-gateway";
import type { PlaceSearch } from "../domain/place-search";

const TYPING_PAUSE_MS = 200;
const CATALOG_FRESH_MS = 5 * 60 * 1000; // the catalog changes a few times a year

interface PlaceSearchOptions {
  readonly typingPauseMs?: number;
}

/** Headless place search: owns the typed text, asks the API once typing pauses. */
export function usePlaceSearch({
  typingPauseMs = TYPING_PAUSE_MS,
}: PlaceSearchOptions = {}): PlaceSearch {
  const [query, setQuery] = useState("");
  const settledQuery = useDebouncedValue(query.trim(), typingPauseMs);

  const { data, status } = useQuery({
    queryKey: ["places", "search", settledQuery],
    queryFn: ({ signal }) => searchPlaces(settledQuery, signal),
    placeholderData: keepPreviousData,
    staleTime: CATALOG_FRESH_MS,
  });

  return {
    query,
    setQuery,
    places: data ?? [],
    status: status === "pending" ? "loading" : status === "success" ? "ready" : "failed",
  };
}
