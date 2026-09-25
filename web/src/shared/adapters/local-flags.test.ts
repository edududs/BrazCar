// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { readFlag, writeFlag } from "./local-flags";

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("a per-device flag", () => {
  it("reads as unset until it is written", () => {
    expect(readFlag("install-hint-dismissed")).toBe(false);
    writeFlag("install-hint-dismissed");
    expect(readFlag("install-hint-dismissed")).toBe(true);
  });

  it("is namespaced, so it never collides with an unrelated key", () => {
    writeFlag("install-hint-dismissed");
    expect(window.localStorage.getItem("brazcar:install-hint-dismissed")).toBe("1");
  });

  it("reads as unset, never throws, when storage is blocked", () => {
    const proto = Object.getPrototypeOf(window.localStorage) as Storage;
    vi.spyOn(proto, "getItem").mockImplementation(() => {
      throw new DOMException("blocked");
    });
    expect(readFlag("install-hint-dismissed")).toBe(false);
  });

  it("is silently not remembered, never throws, when storage rejects the write", () => {
    const proto = Object.getPrototypeOf(window.localStorage) as Storage;
    vi.spyOn(proto, "setItem").mockImplementation(() => {
      throw new DOMException("blocked");
    });
    expect(() => {
      writeFlag("install-hint-dismissed");
    }).not.toThrow();
  });
});
