import { describe, expect, it } from "vitest";

import { BOARD_UTC_OFFSET } from "@/shared/domain/board-time-zone";

import { dayCards, formatDayShort, localDay, monthGrid, relativeDay, shiftMonth } from "./calendar";

/** Thursday, 24 September 2026, 14:52 on the board's own clock (D-094), not the runner's. */
const now = new Date(`2026-09-24T14:52:00${BOARD_UTC_OFFSET}`);

describe("dayCards", () => {
  it("offers today, tomorrow and the days after, by weekday", () => {
    expect(dayCards(now).map((card) => [card.day, card.label, card.weekday, card.number])).toEqual([
      ["2026-09-24", "Hoje", "Hoje", 24],
      ["2026-09-25", "Amanhã", "Amanhã", 25],
      ["2026-09-26", "Sáb 26", "Sáb", 26],
      ["2026-09-27", "Dom 27", "Dom", 27],
    ]);
  });
});

describe("day words", () => {
  it("writes a day short, and relative to now for a sentence", () => {
    expect(formatDayShort("2026-09-24")).toBe("Qui, 24 set");
    expect(relativeDay("2026-09-24", now)).toBe("hoje");
    expect(relativeDay("2026-09-25", now)).toBe("amanhã");
    expect(relativeDay("2026-09-26", now)).toBe("sábado, 26 de setembro");
  });
});

describe("monthGrid", () => {
  it("lays September 2026 out in weeks from Sunday, padded with nulls", () => {
    const grid = monthGrid(2026, 9);
    expect(grid.title).toBe("Setembro de 2026");
    expect(grid.weeks).toHaveLength(5);
    expect(grid.weeks[0]).toEqual([
      null,
      null,
      "2026-09-01",
      "2026-09-02",
      "2026-09-03",
      "2026-09-04",
      "2026-09-05",
    ]);
    expect(grid.weeks[4]?.slice(0, 4)).toEqual([
      "2026-09-27",
      "2026-09-28",
      "2026-09-29",
      "2026-09-30",
    ]);
    expect(grid.weeks[4]?.[4]).toBeNull();
  });

  it("moves across the year end", () => {
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
    expect(localDay(new Date(`2026-01-05T12:00:00${BOARD_UTC_OFFSET}`))).toBe("2026-01-05");
  });
});
