// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PHONE_HINT_ERROR } from "@/shared/app/use-phone-input";

import type { FeedbackData } from "../domain/feedback";
import { EMPTY_MESSAGE_ERROR, useFeedbackDraft } from "./use-feedback-draft";

describe("useFeedbackDraft", () => {
  it("starts as a suggestion that names nobody, and refuses an empty message", () => {
    const { result } = renderHook(() => useFeedbackDraft());
    expect(result.current.kind).toBe("suggestion");
    expect(result.current.canNameSomeone).toBe(false);

    act(() => {
      result.current.setMessage("   ");
    });
    let sent: FeedbackData | null = null;
    act(() => {
      sent = result.current.submitValue();
    });

    expect(sent).toBeNull();
    expect(result.current.messageError).toBe(EMPTY_MESSAGE_ERROR);

    act(() => {
      result.current.setMessage("Uma ideia");
    });
    expect(result.current.messageError).toBeNull();
  });

  it("sends the message trimmed and no phone", () => {
    const { result } = renderHook(() => useFeedbackDraft());
    act(() => {
      result.current.setKind("praise");
      result.current.setMessage("  Gostei do mural.  ");
    });

    expect(result.current.submitValue()).toEqual({
      kind: "praise",
      message: "Gostei do mural.",
      aboutPhone: null,
    });
  });

  it("a complaint about someone needs a whole phone and sends it in E.164", () => {
    const { result } = renderHook(() => useFeedbackDraft());
    act(() => {
      result.current.setKind("complaint");
      result.current.setMessage("Não apareceu.");
      result.current.setAboutSomeone(true);
      result.current.phone.onChange("6199999");
    });
    let sent: FeedbackData | null = null;
    act(() => {
      sent = result.current.submitValue();
    });
    expect(sent).toBeNull();
    expect(result.current.phone.error).toBe(PHONE_HINT_ERROR);

    act(() => {
      result.current.phone.onChange("61999990002");
    });

    expect(result.current.submitValue()).toEqual({
      kind: "complaint",
      message: "Não apareceu.",
      aboutPhone: "+5561999990002",
    });
  });

  it("leaving the complaint drops the person, whatever was typed", () => {
    const { result } = renderHook(() => useFeedbackDraft());
    act(() => {
      result.current.setKind("complaint");
      result.current.setMessage("Algo.");
      result.current.setAboutSomeone(true);
      result.current.phone.onChange("61999990002");
    });
    act(() => {
      result.current.setKind("suggestion");
    });

    expect(result.current.aboutSomeone).toBe(false);
    expect(result.current.submitValue()?.aboutPhone).toBeNull();
  });
});
