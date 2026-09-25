import { describe, expect, it } from "vitest";

import { formatAsTyped, toE164 } from "./phone-codec";

describe("formatAsTyped", () => {
  it("formats a Brazilian mobile as it is typed, digit by digit", () => {
    expect(formatAsTyped("6")).toBe("6");
    expect(formatAsTyped("61")).toBe("(61)");
    expect(formatAsTyped("61999990001")).toBe("(61) 99999-0001");
  });
});

describe("toE164", () => {
  it("is the whole number in E.164 once it is complete", () => {
    expect(toE164("61999990001")).toBe("+5561999990001");
  });

  it("is null for a half-typed or otherwise invalid number", () => {
    expect(toE164("619999")).toBeNull();
    expect(toE164("")).toBeNull();
  });

  it("reads an explicit country code instead of assuming Brazil", () => {
    expect(toE164("+14155552671")).toBe("+14155552671");
  });
});
