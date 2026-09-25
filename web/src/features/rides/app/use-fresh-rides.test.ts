// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Ride } from "../domain/ride";
import { openRide } from "./ride.fixture";
import { useFreshRides } from "./use-fresh-rides";

const ride = (id: string): Ride => ({ ...openRide, id });

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("useFreshRides", () => {
  it("marks nothing on the first list, then only what arrived, and forgets it later", () => {
    const first = [ride("a"), ride("b")];
    const { result, rerender } = renderHook(({ rides }) => useFreshRides(rides, { freshMs: 100 }), {
      initialProps: { rides: first },
    });
    expect(result.current.size).toBe(0);

    rerender({ rides: [ride("a"), ride("c"), ride("b")] });
    expect([...result.current]).toEqual(["c"]);

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current.size).toBe(0);
  });

  it("marks nothing when the list only lost rides or stayed the same", () => {
    const { result, rerender } = renderHook(({ rides }) => useFreshRides(rides), {
      initialProps: { rides: [ride("a"), ride("b")] },
    });
    rerender({ rides: [ride("a")] });
    rerender({ rides: [ride("a")] });
    expect(result.current.size).toBe(0);
  });

  it("takes no baseline while the list is still loading, so the first answer is not all new", () => {
    const { result, rerender } = renderHook(({ rides, ready }) => useFreshRides(rides, { ready }), {
      initialProps: { rides: [] as Ride[], ready: false },
    });
    rerender({ rides: [ride("a"), ride("b")], ready: true });
    expect(result.current.size).toBe(0);
    rerender({ rides: [ride("a"), ride("b"), ride("c")], ready: true });
    expect([...result.current]).toEqual(["c"]);
  });
});
