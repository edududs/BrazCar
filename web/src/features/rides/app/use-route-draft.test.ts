// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { StopDraft } from "../domain/ride";
import { useRouteDraft } from "./use-route-draft";

const braz: StopDraft = { placeId: "brazlandia", text: "", fare: "" };
const incra: StopDraft = { placeId: null, text: "Incra 8", fare: "" };
const esplanada: StopDraft = { placeId: "esplanada", text: "", fare: "" };

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

  it("reports a fare on any stop but the origin, so the price stops being typed (D-131)", () => {
    const { result } = renderHook(() => useRouteDraft([braz, incra, esplanada]));
    const keys = result.current.stops.map((s) => s.key);

    expect(result.current.hasFares).toBe(false);

    act(() => {
      result.current.change(keys[1] ?? -1, { ...incra, fare: "9.00" });
    });
    expect(result.current.hasFares).toBe(true);

    act(() => {
      result.current.change(keys[1] ?? -1, { ...incra, fare: "  " });
    });
    expect(result.current.hasFares).toBe(false);
  });
});
