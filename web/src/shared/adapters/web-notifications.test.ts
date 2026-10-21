// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { readPushPermission, requestPushPermission } from "./web-notifications";

const iPhone = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)";
const desktop = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)";

const requestPermission = vi.fn<() => Promise<NotificationPermission>>();
let permission: NotificationPermission = "default";

function supported(): void {
  vi.stubGlobal(
    "Notification",
    Object.defineProperties(
      {},
      {
        permission: { get: () => permission },
        requestPermission: { value: requestPermission },
      },
    ),
  );
  vi.stubGlobal("PushManager", {});
  Object.defineProperty(navigator, "serviceWorker", { value: {}, configurable: true });
}

beforeEach(() => {
  permission = "default";
  requestPermission.mockReset().mockImplementation(() => {
    permission = "granted";
    return Promise.resolve(permission);
  });
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue(desktop);
  vi.spyOn(window, "matchMedia").mockReturnValue({ matches: false } as MediaQueryList);
  Object.defineProperty(navigator, "maxTouchPoints", { value: 0, configurable: true });
  Reflect.deleteProperty(window, "Notification");
  Reflect.deleteProperty(window, "PushManager");
  Reflect.deleteProperty(navigator, "serviceWorker");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  Reflect.deleteProperty(navigator, "maxTouchPoints");
  Reflect.deleteProperty(navigator, "serviceWorker");
});

describe("readPushPermission", () => {
  it("is 'unsupported' in an ordinary browser with no Notification", () => {
    expect(readPushPermission()).toBe("unsupported");
  });

  it("is 'needs-install' on an iPhone in a browser tab", () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(iPhone);
    expect(readPushPermission()).toBe("needs-install");
  });

  it("is 'unsupported' on an installed iPhone app that still lacks the API", () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(iPhone);
    vi.spyOn(window, "matchMedia").mockReturnValue({ matches: true } as MediaQueryList);
    expect(readPushPermission()).toBe("unsupported");
  });

  it.each(["default", "granted", "denied"] as const)("reports the browser's '%s'", (state) => {
    supported();
    permission = state;
    expect(readPushPermission()).toBe(state);
  });
});

describe("requestPushPermission", () => {
  it("asks when the browser has not been asked, and returns the new state", async () => {
    supported();

    await expect(requestPushPermission()).resolves.toBe("granted");
    expect(requestPermission).toHaveBeenCalledOnce();
  });

  it.each(["denied", "granted"] as const)("does not ask again when it is '%s'", async (state) => {
    supported();
    permission = state;

    await expect(requestPushPermission()).resolves.toBe(state);
    expect(requestPermission).not.toHaveBeenCalled();
  });
});
