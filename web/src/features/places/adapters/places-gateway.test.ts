import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchPlace, searchPlaces } from "./places-gateway";

const api = await vi.hoisted(async () => {
  const { installFakeApi } = await import("@/shared/testing/fake-api");
  return installFakeApi();
});

const incra = {
  id: "incra-8",
  name: "Incra 8",
  kind: "area",
  aliases: ["Incra"],
  parent_id: "brazlandia",
} as const;

const signal = new AbortController().signal;

beforeEach(() => {
  api.reset();
});

describe("searchPlaces", () => {
  it("sends the typed words as `q` and turns each place into the screen's", async () => {
    api.answer(200, [incra]);

    const places = await searchPlaces("inc", signal);

    expect(api.last()).toMatchObject({ method: "GET", path: "/api/places" });
    expect(api.last().query.get("q")).toBe("inc");
    expect(places).toEqual([
      { id: "incra-8", name: "Incra 8", kind: "area", aliases: ["Incra"], parentId: "brazlandia" },
    ]);
  });

  it("an error status rejects, so the picker can say the search failed", async () => {
    api.answerText(500, "Internal Server Error");

    await expect(searchPlaces("inc", signal)).rejects.toThrow("status 500");
  });

  it("with the network down it rejects too", async () => {
    api.dropConnection();

    await expect(searchPlaces("inc", signal)).rejects.toBeInstanceOf(TypeError);
  });
});

describe("fetchPlace", () => {
  it("reads one place by id and keeps only the place, not what is beneath it", async () => {
    api.answer(200, { place: incra, descendants: [{ ...incra, id: "child" }] });

    const place = await fetchPlace("incra-8", signal);

    expect(api.last().path).toBe("/api/places/incra-8");
    expect(place?.id).toBe("incra-8");
  });

  it("a place the catalog does not know (404) is null, not an error", async () => {
    api.answer(404, { detail: "Lugar não encontrado." });

    await expect(fetchPlace("nowhere", signal)).resolves.toBeNull();
  });

  it("any other failure rejects", async () => {
    api.answer(503, {});

    await expect(fetchPlace("incra-8", signal)).rejects.toThrow("status 503");
  });
});
