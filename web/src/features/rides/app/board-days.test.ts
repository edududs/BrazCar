import { describe, expect, it } from "vitest";

import { BOARD_UTC_OFFSET } from "@/shared/domain/board-time-zone";

import type { Ride } from "../domain/ride";
import { dayChips, dayTitle, groupByDay, nowLabel } from "./board-days";
import { openRide } from "./ride.fixture";

/** Thursday, 24 September 2026, 14:52 on the board's own clock (D-094), not the runner's. */
const now = new Date(`2026-09-24T14:52:00${BOARD_UTC_OFFSET}`);
const rideAt = (id: string, boardClock: string): Ride => ({
  ...openRide,
  id,
  departureAt: new Date(`${boardClock}${BOARD_UTC_OFFSET}`).toISOString(),
});

describe("dayTitle", () => {
  it("names today and tomorrow, and spells out the other days", () => {
    expect(dayTitle("2026-09-24", now)).toBe("Hoje · quinta, 24");
    expect(dayTitle("2026-09-25", now)).toBe("Amanhã · sexta, 25");
    expect(dayTitle("2026-09-26", now)).toBe("Sábado, 26 de setembro");
  });
});

describe("groupByDay", () => {
  it("keeps the order and splits by local day, flagging today", () => {
    const sections = groupByDay(
      [
        rideAt("a", "2026-09-24T15:00:00"),
        rideAt("b", "2026-09-24T23:30:00"),
        rideAt("c", "2026-09-25T00:10:00"),
      ],
      now,
    );
    expect(sections.map((s) => [s.day, s.rides.map((r) => r.id), s.isToday])).toEqual([
      ["2026-09-24", ["a", "b"], true],
      ["2026-09-25", ["c"], false],
    ]);
  });
});

describe("dayChips", () => {
  it("offers today, tomorrow and the two days after, by weekday", () => {
    expect(dayChips(now)).toEqual([
      { day: "2026-09-24", label: "Hoje" },
      { day: "2026-09-25", label: "Amanhã" },
      { day: "2026-09-26", label: "Sáb 26" },
      { day: "2026-09-27", label: "Dom 27" },
    ]);
  });
});

describe("nowLabel", () => {
  it("says the time", () => {
    expect(nowLabel(now)).toBe("Agora · 14:52");
  });
});
