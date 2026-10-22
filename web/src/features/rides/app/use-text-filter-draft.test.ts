// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useTextFilterDraft } from "./use-text-filter-draft";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useTextFilterDraft", () => {
  it("sends the text once the typing pauses, not on every key", () => {
    const commit = vi.fn();
    const { result } = renderHook(() => useTextFilterDraft("", commit, 200));

    act(() => {
      result.current.setDraft("I");
      result.current.setDraft("In");
    });
    expect(result.current.draft).toBe("In");
    expect(commit).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(commit).toHaveBeenCalledOnce();
    expect(commit).toHaveBeenCalledWith("In");
  });

  it("sends an emptied field at once", () => {
    const commit = vi.fn();
    const { result } = renderHook(() => useTextFilterDraft("sia", commit, 200));

    act(() => {
      result.current.setDraft("");
    });
    expect(commit).toHaveBeenCalledWith("");
  });

  it("keeps the draft when the address echoes an older value it sent", () => {
    const commit = vi.fn();
    const { result, rerender } = renderHook(
      ({ applied }) => useTextFilterDraft(applied, commit, 0),
      { initialProps: { applied: "" } },
    );

    act(() => {
      result.current.setDraft("a");
      vi.advanceTimersByTime(0);
      result.current.setDraft("ab");
      vi.advanceTimersByTime(0);
    });
    rerender({ applied: "a" });
    expect(result.current.draft).toBe("ab");
    rerender({ applied: "ab" });
    expect(result.current.draft).toBe("ab");
  });

  it("takes a value the address changed by itself", () => {
    const { result, rerender } = renderHook(
      ({ applied }) => useTextFilterDraft(applied, vi.fn(), 200),
      { initialProps: { applied: "incra" } },
    );
    expect(result.current.draft).toBe("incra");

    rerender({ applied: "sia" });
    expect(result.current.draft).toBe("sia");
  });
});
