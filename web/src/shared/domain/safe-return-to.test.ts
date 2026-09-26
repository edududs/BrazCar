import { describe, expect, it } from "vitest";

import { isSafeReturnTo } from "./safe-return-to";

describe("isSafeReturnTo", () => {
  it("accepts an internal path, with or without a query", () => {
    expect(isSafeReturnTo("/conta")).toBe(true);
    expect(isSafeReturnTo("/confirmar-email?token=tok-1")).toBe(true);
  });

  it("refuses anything that does not start with a single slash", () => {
    expect(isSafeReturnTo("conta")).toBe(false);
    expect(isSafeReturnTo("")).toBe(false);
  });

  it("refuses a scheme-relative address, which a browser still reads as another site", () => {
    expect(isSafeReturnTo("//evil.example.com")).toBe(false);
    expect(isSafeReturnTo("/\\evil.example.com")).toBe(false);
  });

  it("refuses a full address with its own scheme", () => {
    expect(isSafeReturnTo("https://evil.example.com")).toBe(false);
    expect(isSafeReturnTo("javascript:alert(1)")).toBe(false);
  });
});
