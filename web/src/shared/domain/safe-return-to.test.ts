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
    expect(isSafeReturnTo("//evil.com")).toBe(false);
    expect(isSafeReturnTo("/\\evil.com")).toBe(false);
  });

  it("refuses a full address with its own scheme", () => {
    expect(isSafeReturnTo("https://evil.com")).toBe(false);
    expect(isSafeReturnTo("javascript:alert(1)")).toBe(false);
  });

  it("refuses a raw tab or newline, which a browser strips on its way into the URL", () => {
    // A real tab between the slashes: the browser drops it, so "/\t/evil.com" becomes
    // "//evil.com" by the time it navigates, even though this string still looks internal here.
    expect(isSafeReturnTo("/\t/evil.com")).toBe(false);
    expect(isSafeReturnTo("/\n/evil.com")).toBe(false);
    expect(isSafeReturnTo("/\r/evil.com")).toBe(false);
    expect(isSafeReturnTo("/conta ")).toBe(false);
  });

  it("accepts a literal, percent-encoded tab: nothing here decodes it, and the router does not either when it navigates by href", () => {
    expect(isSafeReturnTo("/%09/evil.com")).toBe(true);
  });
});
