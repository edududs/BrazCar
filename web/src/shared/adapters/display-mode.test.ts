// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { detectDisplayMode, installsByHand } from "./display-mode";

afterEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(navigator, "maxTouchPoints");
});

function stubMatchMedia(matches: boolean) {
  vi.spyOn(window, "matchMedia").mockReturnValue({ matches } as MediaQueryList);
}

function stubUserAgent(userAgent: string, maxTouchPoints = 0) {
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue(userAgent);
  Object.defineProperty(navigator, "maxTouchPoints", { value: maxTouchPoints, configurable: true });
}

describe("detectDisplayMode", () => {
  it("is 'browser' with no standalone signal at all", () => {
    stubMatchMedia(false);
    expect(detectDisplayMode()).toBe("browser");
  });

  it("is 'standalone' when the media query says so, as Android and desktop report it", () => {
    stubMatchMedia(true);
    expect(detectDisplayMode()).toBe("standalone");
  });

  it("is 'standalone' on iOS's own `navigator.standalone`, even without the media query", () => {
    stubMatchMedia(false);
    Object.defineProperty(navigator, "standalone", { value: true, configurable: true });
    expect(detectDisplayMode()).toBe("standalone");
    Reflect.deleteProperty(navigator, "standalone");
  });
});

describe("installsByHand", () => {
  it("is true on an iPhone user agent", () => {
    stubUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)");
    expect(installsByHand()).toBe(true);
  });

  it("is true on an iPad reporting itself as a touch Mac", () => {
    stubUserAgent("Macintosh", 5);
    expect(installsByHand()).toBe(true);
  });

  it("is false on a Mac with no touch screen", () => {
    stubUserAgent("Macintosh", 0);
    expect(installsByHand()).toBe(false);
  });

  it("is false on an ordinary desktop browser", () => {
    stubUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64)", 0);
    expect(installsByHand()).toBe(false);
  });
});
