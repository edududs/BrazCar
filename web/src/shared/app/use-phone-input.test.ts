// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PHONE_HINT_ERROR, usePhoneInput } from "./use-phone-input";

describe("usePhoneInput", () => {
  it("formats the digits as they arrive", () => {
    const { result } = renderHook(() => usePhoneInput());
    act(() => {
      result.current.field.onChange("61999990001");
    });
    expect(result.current.field.value).toBe("(61) 99999-0001");
  });

  it("never reformats while deleting, so the cursor does not fight the mask", () => {
    const { result } = renderHook(() => usePhoneInput());
    act(() => {
      result.current.field.onChange("61999990001");
    });
    act(() => {
      result.current.field.onChange("(61) 99999-000");
    });
    expect(result.current.field.value).toBe("(61) 99999-000");
  });

  it("submits the E.164 number once it is whole, with no error", () => {
    const { result } = renderHook(() => usePhoneInput());
    act(() => {
      result.current.field.onChange("61999990001");
    });
    let submitted: string | null = null;
    act(() => {
      submitted = result.current.submitValue();
    });
    expect(submitted).toBe("+5561999990001");
    expect(result.current.field.error).toBeNull();
  });

  it("submits null and shows the hint for a half-typed number", () => {
    const { result } = renderHook(() => usePhoneInput());
    act(() => {
      result.current.field.onChange("619999");
    });
    let submitted: string | null = "not yet null";
    act(() => {
      submitted = result.current.submitValue();
    });
    expect(submitted).toBeNull();
    expect(result.current.field.error).toBe(PHONE_HINT_ERROR);
  });

  it("clears the error as soon as the person types again", () => {
    const { result } = renderHook(() => usePhoneInput());
    act(() => {
      result.current.submitValue();
    });
    expect(result.current.field.error).toBe(PHONE_HINT_ERROR);
    act(() => {
      result.current.field.onChange("6");
    });
    expect(result.current.field.error).toBeNull();
  });

  it("starts from an initial value", () => {
    const { result } = renderHook(() => usePhoneInput("(61) 99999-0001"));
    expect(result.current.field.value).toBe("(61) 99999-0001");
  });
});
