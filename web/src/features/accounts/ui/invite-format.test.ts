import { describe, expect, it } from "vitest";

import { formatInviteExpiry } from "./invite-format";

describe("formatInviteExpiry", () => {
  it("reads the board's own zone, never the device's (D-165)", () => {
    expect(formatInviteExpiry("2026-09-01T14:00:00-03:00")).toBe("01/09 às 14:00");
  });
});
