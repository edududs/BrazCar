// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BOARD_UTC_OFFSET } from "@/shared/domain/board-time-zone";

import { joinInstant, splitInstant, useDateTimeDraft } from "./use-date-time-draft";

describe("splitInstant and joinInstant", () => {
  it("round-trip an instant through the board's own day and clock (D-094), not the runner's", () => {
    const iso = new Date(`2026-09-24T19:00:00${BOARD_UTC_OFFSET}`).toISOString();
    expect(splitInstant(iso)).toEqual({ day: "2026-09-24", clock: "19:00" });
    expect(joinInstant("2026-09-24", 19, 0)).toBe(iso);
  });
});

describe("useDateTimeDraft", () => {
  it("starts from the instant, changes the day and steps the clock by five minutes", () => {
    const { result } = renderHook(() =>
      useDateTimeDraft(new Date(`2026-09-24T18:30:00${BOARD_UTC_OFFSET}`).toISOString()),
    );
    expect(result.current.day).toBe("2026-09-24");
    expect(result.current.time.value).toBe("18:30");

    act(() => {
      result.current.setDay("2026-09-26");
    });
    act(() => {
      result.current.time.addMinutes(1);
    });
    expect(result.current.time.value).toBe("18:35");
    expect(result.current.value()).toBe(
      new Date(`2026-09-26T18:35:00${BOARD_UTC_OFFSET}`).toISOString(),
    );
  });
});
