import { describe, expect, it } from "vitest";

import { skyOf } from "./sky";

/** Local instants: the tests run in the board's zone (America/Sao_Paulo, set by vitest's TZ). */
const at = (clock: string) => new Date(`2026-09-24T${clock}:00`).toISOString();

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
