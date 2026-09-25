// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useHasUnsavedWork, useUnsavedWork } from "./unsaved-work";

describe("unsaved work", () => {
  it("is false with no screen holding open work", () => {
    const { result } = renderHook(() => useHasUnsavedWork());
    expect(result.current).toBe(false);
  });

  it("is true while a screen marks itself, false again once it unmounts", () => {
    const marker = renderHook(() => {
      useUnsavedWork();
    });
    const reader = renderHook(() => useHasUnsavedWork());
    expect(reader.result.current).toBe(true);

    marker.unmount();
    expect(reader.result.current).toBe(false);
  });

  it("stays true while at least one of several screens is still open", () => {
    const first = renderHook(() => {
      useUnsavedWork();
    });
    const second = renderHook(() => {
      useUnsavedWork();
    });
    const reader = renderHook(() => useHasUnsavedWork());

    first.unmount();
    expect(reader.result.current).toBe(true);

    second.unmount();
    expect(reader.result.current).toBe(false);
  });
});
