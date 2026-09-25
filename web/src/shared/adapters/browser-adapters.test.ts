// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { detectDisplayMode, installsByHand } from "./display-mode";
import { readFlag, writeFlag } from "./local-flags";
import { readNetworkStatus, subscribeToNetworkStatus } from "./network-status";
import { copyText, shareText } from "./text-export";

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

function pretendNavigator(values: Record<string, unknown>) {
  for (const [key, value] of Object.entries(values)) {
    Object.defineProperty(navigator, key, { value, configurable: true });
  }
}

function forgetNavigator(...keys: string[]) {
  for (const key of keys) Reflect.deleteProperty(navigator, key);
}

describe("detectDisplayMode", () => {
  afterEach(() => {
    forgetNavigator("standalone");
  });

  it("a browser tab is the browser", () => {
    expect(detectDisplayMode()).toBe("browser");
  });

  it("the app added to the iPhone's home screen is standalone", () => {
    pretendNavigator({ standalone: true });

    expect(detectDisplayMode()).toBe("standalone");
  });

  it("an installed app elsewhere is told by the display-mode query", () => {
    vi.spyOn(window, "matchMedia").mockImplementation(
      (query) => ({ matches: query === "(display-mode: standalone)" }) as MediaQueryList,
    );

    expect(detectDisplayMode()).toBe("standalone");
  });
});

describe("installsByHand", () => {
  const userAgent = navigator.userAgent;
  afterEach(() => {
    pretendNavigator({ userAgent, maxTouchPoints: 0 });
  });

  it("an iPhone installs by hand", () => {
    pretendNavigator({
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
      maxTouchPoints: 5,
    });

    expect(installsByHand()).toBe(true);
  });

  it("an iPad that says it is a Mac is caught by its touch screen", () => {
    pretendNavigator({
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
      maxTouchPoints: 5,
    });

    expect(installsByHand()).toBe(true);
  });

  it("a real Mac, without touch, and an Android phone do not", () => {
    pretendNavigator({
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
      maxTouchPoints: 0,
    });
    expect(installsByHand()).toBe(false);

    pretendNavigator({ userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8)", maxTouchPoints: 5 });
    expect(installsByHand()).toBe(false);
  });
});

describe("local flags", () => {
  it("an unset flag reads false, and a written one reads true under the app's prefix", () => {
    expect(readFlag("install-hint-dismissed")).toBe(false);

    writeFlag("install-hint-dismissed");

    expect(readFlag("install-hint-dismissed")).toBe(true);
    expect(window.localStorage.getItem("brazcar:install-hint-dismissed")).toBe("1");
  });

  it("storage that throws (private mode) reads as unset and writing does not break", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });

    expect(() => {
      writeFlag("x");
    }).not.toThrow();
    expect(readFlag("x")).toBe(false);
  });
});

describe("network status", () => {
  it("reads the browser's own word", () => {
    const onLine = vi.spyOn(navigator, "onLine", "get");

    onLine.mockReturnValue(true);
    expect(readNetworkStatus()).toBe("online");
    onLine.mockReturnValue(false);
    expect(readNetworkStatus()).toBe("offline");
  });

  it("tells the subscriber on both changes, and stops after unsubscribing", () => {
    const onChange = vi.fn();
    const stop = subscribeToNetworkStatus(onChange);

    window.dispatchEvent(new Event("offline"));
    window.dispatchEvent(new Event("online"));
    stop();
    window.dispatchEvent(new Event("offline"));

    expect(onChange).toHaveBeenCalledTimes(2);
  });
});

describe("text export", () => {
  afterEach(() => {
    forgetNavigator("clipboard", "share");
  });

  it("copies to the clipboard", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    pretendNavigator({ clipboard: { writeText } });

    await expect(copyText("olá")).resolves.toBe("copied");
    expect(writeText).toHaveBeenCalledWith("olá");
  });

  it("a clipboard that refuses is a failure, not an exception", async () => {
    pretendNavigator({ clipboard: { writeText: () => Promise.reject(new Error("denied")) } });

    await expect(copyText("olá")).resolves.toBe("failed");
  });

  it("shares through the system sheet where there is one", async () => {
    const share = vi.fn(() => Promise.resolve());
    pretendNavigator({ share });

    await expect(shareText("Registro", "linhas")).resolves.toBe("shared");
    expect(share).toHaveBeenCalledWith({ title: "Registro", text: "linhas" });
  });

  it("a share sheet closed without sharing is a failure", async () => {
    pretendNavigator({ share: () => Promise.reject(new DOMException("abort", "AbortError")) });

    await expect(shareText("Registro", "linhas")).resolves.toBe("failed");
  });

  it("without a share sheet it falls back to the clipboard", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    pretendNavigator({ clipboard: { writeText } });

    await expect(shareText("Registro", "linhas")).resolves.toBe("copied");
    expect(writeText).toHaveBeenCalledWith("linhas");
  });
});
