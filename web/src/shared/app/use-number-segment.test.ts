// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useNumberSegment } from "./use-number-segment";

function hourSegment(value = 18) {
  const onCommit = vi.fn();
  const onComplete = vi.fn();
  const hook = renderHook(() => useNumberSegment({ value, max: 23, onCommit, onComplete }));
  return { ...hook, onCommit, onComplete };
}

describe("useNumberSegment", () => {
  it("empties on focus so the first digit replaces the value, the old one as a hint", () => {
    const { result } = hourSegment();
    expect(result.current.text).toBe("18");
    act(() => {
      result.current.onFocus();
    });
    expect(result.current.text).toBe("");
    expect(result.current.placeholder).toBe("18");
  });

  it("takes two digits typed one by one, committing as it goes, then moves on", () => {
    const { result, onCommit, onComplete } = hourSegment();
    act(() => {
      result.current.onFocus();
    });
    act(() => {
      result.current.onChange("1");
    });
    expect(result.current.text).toBe("1");
    expect(onCommit).toHaveBeenLastCalledWith(1);
    expect(onComplete).not.toHaveBeenCalled();

    act(() => {
      result.current.onChange("19");
    });
    expect(result.current.text).toBe("19");
    expect(onCommit).toHaveBeenLastCalledWith(19);
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it("keeps the last digits when the field had more, as after a paste or a caret in the middle", () => {
    const { result, onCommit } = hourSegment();
    act(() => {
      result.current.onChange("0719");
    });
    expect(result.current.text).toBe("19");
    expect(onCommit).toHaveBeenLastCalledWith(19);
  });

  it("ignores what is not a digit", () => {
    const { result, onCommit } = hourSegment();
    act(() => {
      result.current.onChange("7h");
    });
    expect(result.current.text).toBe("7");
    expect(onCommit).toHaveBeenLastCalledWith(7);
  });

  it("refuses a value out of range, says so, and shows the committed value on leaving", () => {
    const { result, onCommit } = hourSegment(18);
    act(() => {
      result.current.onFocus();
    });
    act(() => {
      result.current.onChange("25");
    });
    expect(result.current.invalid).toBe(true);
    expect(onCommit).not.toHaveBeenCalledWith(25);
    act(() => {
      result.current.onBlur();
    });
    expect(result.current.text).toBe("18");
    expect(result.current.invalid).toBe(false);
  });

  it("leaves the value alone when the field is emptied and left", () => {
    const { result, onCommit } = hourSegment(18);
    act(() => {
      result.current.onFocus();
    });
    act(() => {
      result.current.onBlur();
    });
    expect(result.current.text).toBe("18");
    expect(onCommit).not.toHaveBeenCalled();
  });
});
