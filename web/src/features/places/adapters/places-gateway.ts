import { apiClient } from "@/shared/adapters/api/client";
import type { components } from "@/shared/adapters/api/schema";

import type { Place } from "../domain/place";

type PlaceOut = components["schemas"]["PlaceOut"];

function toPlace(out: PlaceOut): Place {
  return {
    id: out.id,
    name: out.name,
    kind: out.kind,
    aliases: out.aliases,
    parentId: out.parent_id,
  };
}

/** Places whose name or alias matches `query`; the API owns what "matches" means. Blank lists all. */
export async function searchPlaces(query: string, signal: AbortSignal): Promise<Place[]> {
  const { data, response } = await apiClient.GET("/api/places", {
    params: { query: { q: query } },
    signal,
  });
  if (data === undefined) {
    throw new Error(`Place search failed with status ${String(response.status)}`);
  }
  return data.map(toPlace);
}

/** One place by identifier, without what is beneath it; `null` when the catalog does not know it. */
export async function fetchPlace(placeId: string, signal: AbortSignal): Promise<Place | null> {
  const { data, response } = await apiClient.GET("/api/places/{place_id}", {
    params: { path: { place_id: placeId } },
    signal,
  });
  if (data !== undefined) return toPlace(data.place);
  if (response.status === 404) return null;
  throw new Error(`Place lookup failed with status ${String(response.status)}`);
}
