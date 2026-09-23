import { describe, expect, it } from "vitest";

import { isBelowFloor } from "./version-floor";

describe("isBelowFloor", () => {
  it.each([
    ["0.6.0", "0.7.0", true],
    ["0.7.0", "0.7.0", false],
    ["0.7.1", "0.7.0", false],
    ["0.10.0", "0.9.0", false], // numbers, not text: "10" > "9"
    ["0.9.9", "0.10.0", true],
    ["1.0.0", "0.99.99", false],
    ["0.7.0", "0.0.0", false],
    ["0.7.0-rc.1", "0.7.0", false], // the suffix is ignored
  ])("%s against a floor of %s is below: %s", (current, minimum, below) => {
    expect(isBelowFloor(current, minimum)).toBe(below);
  });

  it.each([
    ["dev", "0.7.0"],
    ["0.6.0", "latest"],
    ["", ""],
  ])("never locks the app out on something unreadable (%s, %s)", (current, minimum) => {
    expect(isBelowFloor(current, minimum)).toBe(false);
  });
});
