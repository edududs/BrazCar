// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useClock } from "./use-clock";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-15T09:00:00-03:00"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useClock", () => {
  it("starts at the current moment", () => {
    const { result } = renderHook(() => useClock());
    expect(result.current.toISOString()).toBe(new Date("2026-01-15T09:00:00-03:00").toISOString());
  });

  it("advances only after the interval elapses", () => {
    const { result } = renderHook(() => useClock(1000));
    const first = result.current;
    act(() => {
      vi.advanceTimersByTime(999);
    });
    expect(result.current).toBe(first);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.getTime()).toBe(first.getTime() + 1000);
  });

  it("stops ticking once unmounted", () => {
    const { result, unmount } = renderHook(() => useClock(1000));
    const before = result.current;
    unmount();
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current).toBe(before);
  });
});
