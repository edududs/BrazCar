// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { parseClock, useTimeDraft } from "./use-time-draft";

describe("parseClock", () => {
  it("reads HH:MM and refuses anything else", () => {
    expect(parseClock("18:00")).toEqual({ hour: 18, minute: 0 });
    expect(parseClock("6:05")).toEqual({ hour: 6, minute: 5 });
    expect(parseClock("24:00")).toBeNull();
    expect(parseClock("agora")).toBeNull();
  });
});

describe("useTimeDraft", () => {
  it("steps hours around the day and minutes on the grid, carrying over", () => {
    const { result } = renderHook(() => useTimeDraft("23:45"));
    act(() => {
      result.current.addMinutes(1);
    });
    expect(result.current.value).toBe("00:00");
    act(() => {
      result.current.addHours(-1);
    });
    expect(result.current.value).toBe("23:00");
    act(() => {
      result.current.addMinutes(-1);
    });
    expect(result.current.value).toBe("22:45");
  });

  it("lands on the grid from an odd minute, and takes a whole clock", () => {
    const { result } = renderHook(() => useTimeDraft("14:52"));
    act(() => {
      result.current.addMinutes(1);
    });
    expect(result.current.value).toBe("15:00");
    act(() => {
      result.current.set("06:30");
    });
    expect(result.current.value).toBe("06:30");
    act(() => {
      result.current.set("nope");
    });
    expect(result.current.value).toBe("06:30");
  });

  it("starts at six when the initial value is not a clock", () => {
    const { result } = renderHook(() => useTimeDraft(""));
    expect(result.current.value).toBe("06:00");
  });
});
