import { describe, expect, it } from "vitest";

import { BOARD_UTC_OFFSET } from "@/shared/domain/board-time-zone";

import { skyOf } from "./sky";

/** The board's own clock (D-094), pinned by offset so the runner's zone cannot fake a pass. */
const at = (clock: string) => new Date(`2026-09-24T${clock}:00${BOARD_UTC_OFFSET}`).toISOString();

describe("skyOf", () => {
  it.each([
    ["03:59", "night"],
    ["04:00", "dawn"],
    ["07:59", "dawn"],
    ["08:00", "day"],
    ["16:59", "day"],
    ["17:00", "dusk"],
    ["19:59", "dusk"],
    ["20:00", "night"],
    ["00:00", "night"],
  ] as const)("at %s the sky is %s", (clock, sky) => {
    expect(skyOf(at(clock))).toBe(sky);
  });
});
