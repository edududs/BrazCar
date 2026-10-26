import { type Place, usePlacesMatching } from "@/features/places";

import type { Stop } from "../domain/ride";

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
  const places = usePlacesMatching(key);
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
