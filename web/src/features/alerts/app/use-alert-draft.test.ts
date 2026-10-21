// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { type AlertSeed, useAlertDraft } from "./use-alert-draft";

// 2026-09-24 (Thursday) 10:20 on the board's clock (UTC-3).
const now = new Date("2026-09-24T13:20:00Z");
const noSeed: AlertSeed = { day: null, text: null, fromTime: null };

const draftOf = (seed: AlertSeed, at = now) => renderHook(() => useAlertDraft({ seed, now: at }));

describe("useAlertDraft", () => {
  it("offers today and the three days after, named as the cards name them", () => {
    const { result } = draftOf(noSeed);

    expect(result.current.dayOptions.map((option) => option.label)).toEqual([
      "Hoje",
      "Amanhã",
      "Sáb 26",
      "Dom 27",
    ]);
  });

  it("starts from today, an empty text and both ends off, with the clock at the board's now", () => {
    const { result } = draftOf(noSeed);

    expect(result.current.day).toBe("2026-09-24");
    expect(result.current.text).toBe("");
    expect(result.current.from.on).toBe(false);
    expect(result.current.from.time.value).toBe("10:20");
    expect(result.current.until.on).toBe(false);
    expect(result.current.until.time.value).toBe("11:20");
    expect(result.current.value()).toEqual({
      day: "2026-09-24",
      text: null,
      fromTime: null,
      untilTime: null,
    });
  });

  it("takes the board's filter as the start", () => {
    const { result } = draftOf({ day: "2026-09-26", text: "incra", fromTime: "07:30" });

    expect(result.current.day).toBe("2026-09-26");
    expect(result.current.text).toBe("incra");
    expect(result.current.from.on).toBe(true);
    expect(result.current.from.time.value).toBe("07:30");
    expect(result.current.until.time.value).toBe("08:30");
  });

  it("falls back to today when the filter's day is not among the options", () => {
    const { result } = draftOf({ day: "2026-12-01", text: null, fromTime: null });

    expect(result.current.day).toBe("2026-09-24");
  });

  it("reads the board's day, not the device's, late at night", () => {
    // 00:30 UTC on the 25th is still the 24th at 21:30 on the board.
    const { result } = draftOf(noSeed, new Date("2026-09-25T00:30:00Z"));

    expect(result.current.day).toBe("2026-09-24");
    expect(result.current.from.time.value).toBe("21:30");
  });

  it("holds the until clock to 23:45", () => {
    const { result } = draftOf({ day: null, text: null, fromTime: "23:30" });

    expect(result.current.until.time.value).toBe("23:45");
  });

  it("sends the trimmed text and only the ends that are on", () => {
    const { result } = draftOf(noSeed);

    act(() => {
      result.current.setDay("2026-09-25");
      result.current.setText("  Gol prata  ");
      result.current.from.setOn(true);
      result.current.until.setOn(true);
      result.current.until.time.set("12:00");
    });

    expect(result.current.value()).toEqual({
      day: "2026-09-25",
      text: "Gol prata",
      fromTime: "10:20",
      untilTime: "12:00",
    });

    act(() => {
      result.current.setText("   ");
      result.current.from.setOn(false);
    });

    expect(result.current.value()).toMatchObject({ text: null, fromTime: null });
  });
});
