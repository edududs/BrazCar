import { afterEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/shared/adapters/api/client";

import { fetchPlace, searchPlaces } from "./places-gateway";

vi.mock("@/shared/adapters/api/client", () => ({ apiClient: { GET: vi.fn() } }));

const get = vi.mocked(apiClient.GET);

afterEach(() => {
  vi.resetAllMocks();
});

const PLACE_OUT = {
  id: "brazlandia",
  name: "Brazlândia",
  kind: "area",
  aliases: ["Braz"],
  parent_id: null,
};
const PLACE = {
  id: "brazlandia",
  name: "Brazlândia",
  kind: "area",
  aliases: ["Braz"],
  parentId: null,
};

describe("searchPlaces", () => {
  it("translates every match", async () => {
    get.mockResolvedValue({ data: [PLACE_OUT], response: { status: 200 } });
    const controller = new AbortController();
    await expect(searchPlaces("braz", controller.signal)).resolves.toEqual([PLACE]);
    expect(get).toHaveBeenCalledWith("/api/places", {
      params: { query: { q: "braz" } },
      signal: controller.signal,
    });
  });

  it("throws with the status when the API fails", async () => {
    get.mockResolvedValue({ data: undefined, response: { status: 500 } });
    await expect(searchPlaces("braz", new AbortController().signal)).rejects.toThrow("500");
  });
});

describe("fetchPlace", () => {
  it("translates the place, ignoring its descendants", async () => {
    get.mockResolvedValue({
      data: { place: PLACE_OUT, descendants: [] },
      response: { status: 200 },
    });
    await expect(fetchPlace("brazlandia", new AbortController().signal)).resolves.toEqual(PLACE);
  });

  it("is null when the catalog does not know it", async () => {
    get.mockResolvedValue({ data: undefined, response: { status: 404 } });
    await expect(fetchPlace("nada", new AbortController().signal)).resolves.toBeNull();
  });

  it("throws with the status on any other failure", async () => {
    get.mockResolvedValue({ data: undefined, response: { status: 500 } });
    await expect(fetchPlace("brazlandia", new AbortController().signal)).rejects.toThrow("500");
  });
});
