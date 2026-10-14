import { describe, expect, it } from "vitest";

import { formatAsTyped, toE164, withNinthDigit } from "./phone-codec";

describe("withNinthDigit", () => {
  it("adds the ninth digit to a mobile typed with eight", () => {
    expect(withNinthDigit("6199084038")).toBe("(61) 99908-4038");
    expect(withNinthDigit("(61) 9908-4038")).toBe("(61) 99908-4038");
  });

  it("is null when nothing is missing or the number is not a mobile that lost its 9", () => {
    expect(withNinthDigit("61999084038")).toBeNull();
    expect(withNinthDigit("6132540000")).toBeNull();
    expect(withNinthDigit("619908")).toBeNull();
    expect(withNinthDigit("")).toBeNull();
  });
});

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
