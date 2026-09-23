// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useRouteDraft } from "./use-route-draft";

const braz = { placeId: "brazlandia", text: "" };
const incra = { placeId: null, text: "Incra 8" };
const esplanada = { placeId: "esplanada", text: "" };

describe("useRouteDraft", () => {
  it("starts with an origin and a destination, and nothing in between", () => {
    const { result } = renderHook(() => useRouteDraft([]));

    expect(result.current.stops.map((s) => s.role)).toEqual(["origin", "destination"]);
  });

  it("puts a new stop right before the destination and keeps every key", () => {
    const { result } = renderHook(() => useRouteDraft([braz, esplanada]));
    const [origin, destination] = result.current.stops;

    act(() => {
      result.current.addWaypoint();
    });
    const waypoint = result.current.stops[1];
    act(() => {
      if (waypoint !== undefined) result.current.change(waypoint.key, incra);
    });

    expect(result.current.value()).toEqual([braz, incra, esplanada]);
    expect(result.current.stops.map((s) => s.role)).toEqual(["origin", "waypoint", "destination"]);
    expect(result.current.stops[0]?.key).toBe(origin?.key);
    expect(result.current.stops[2]?.key).toBe(destination?.key);
  });

  it("removes a waypoint but never the origin or the destination", () => {
    const { result } = renderHook(() => useRouteDraft([braz, incra, esplanada]));
    const keys = result.current.stops.map((s) => s.key);

    act(() => {
      result.current.remove(keys[0] ?? -1);
    });
    act(() => {
      result.current.remove(keys[2] ?? -1);
    });
    expect(result.current.value()).toEqual([braz, incra, esplanada]);

    act(() => {
      result.current.remove(keys[1] ?? -1);
    });
    expect(result.current.value()).toEqual([braz, esplanada]);
  });
});
