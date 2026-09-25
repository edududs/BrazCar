import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { searchPlaces } from "@/features/places/adapters/places-gateway";
import type { Place } from "@/features/places/domain/place";

import type { Stop } from "../domain/ride";

const CATALOG_FRESH_MS = 5 * 60 * 1000;

export interface BoardMatch {
  /** True for a stop that answered the "passa por" text: by its words, or by the place behind it. */
  readonly matches: (stop: Stop) => boolean;
  /** "Mostrando caronas que passam por Setor Comercial Sul (SCS)." when an alias did the work. */
  readonly note: string | null;
}

/** Accents and case out of the way, as the API compares (D-101). */
export function searchKey(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

function byAlias(place: Place, key: string): boolean {
  return searchKey(place.name) !== key && place.aliases.some((alias) => searchKey(alias) === key);
}

/**
 * Why a ride is on the board: the stops the "passa por" text hit, so the card can mark them
 * (S02). The API does the matching; this only explains it, with the catalog's help for aliases.
 */
export function useBoardMatch(text: string | null): BoardMatch {
  const key = text === null ? "" : searchKey(text);
  const { data } = useQuery({
    queryKey: ["places", "search", key],
    queryFn: ({ signal }) => searchPlaces(key, signal),
    enabled: key !== "",
    placeholderData: keepPreviousData,
    staleTime: CATALOG_FRESH_MS,
  });
  const places = key === "" ? [] : (data ?? []);
  const ids = new Set(places.map((place) => place.id));
  const aliased = places.find((place) => byAlias(place, key));
  return {
    matches: (stop) =>
      key !== "" &&
      ((stop.placeId !== null && ids.has(stop.placeId)) || searchKey(stop.label).includes(key)),
    note:
      aliased === undefined
        ? null
        : `Mostrando caronas que passam por ${aliased.name} (${text ?? ""}).`,
  };
}
