// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { THEME_ATTRIBUTE, THEME_STORAGE_KEY } from "../adapters/theme";
import { setSystemTheme } from "../testing/setup";
import { useTheme } from "./use-theme";

afterEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute(THEME_ATTRIBUTE);
  setSystemTheme("light");
});

describe("useTheme", () => {
  it("starts on the system theme and follows the device", () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.preference).toBe("system");
    expect(result.current.resolved).toBe("light");

    act(() => {
      setSystemTheme("dark");
    });
    expect(result.current.resolved).toBe("dark");
    expect(document.documentElement.hasAttribute(THEME_ATTRIBUTE)).toBe(false);
  });

  it("remembers a manual choice and paints it, whatever the device says", () => {
    const { result } = renderHook(() => useTheme());
    act(() => {
      result.current.set("dark");
    });
    expect(result.current.resolved).toBe("dark");
    expect(document.documentElement.getAttribute(THEME_ATTRIBUTE)).toBe("dark");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");

    act(() => {
      setSystemTheme("light");
    });
    expect(result.current.resolved).toBe("dark");
  });

  it("wakes up with the stored choice", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "light");
    setSystemTheme("dark");
    const { result } = renderHook(() => useTheme());
    expect(result.current.preference).toBe("light");
    expect(result.current.resolved).toBe("light");
  });
});
