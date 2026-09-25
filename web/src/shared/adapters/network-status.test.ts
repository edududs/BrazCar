// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { readNetworkStatus, subscribeToNetworkStatus } from "./network-status";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("readNetworkStatus", () => {
  it("reads the browser's own signal", () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    expect(readNetworkStatus()).toBe("online");
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    expect(readNetworkStatus()).toBe("offline");
  });
});

describe("subscribeToNetworkStatus", () => {
  it("calls back on both online and offline, and stops once unsubscribed", () => {
    const onChange = vi.fn();
    const unsubscribe = subscribeToNetworkStatus(onChange);

    window.dispatchEvent(new Event("offline"));
    window.dispatchEvent(new Event("online"));
    expect(onChange).toHaveBeenCalledTimes(2);

    unsubscribe();
    window.dispatchEvent(new Event("online"));
    expect(onChange).toHaveBeenCalledTimes(2);
  });
});
