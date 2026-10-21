// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useDevicePush } from "./use-device-push";

const api = await vi.hoisted(async () => {
  const { installFakeApi } = await import("@/shared/testing/fake-api");
  return installFakeApi();
});

const iPhone = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)";
const desktop = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)";
/** base64url of the bytes 251, 255, 190. */
const KEY = "-_--";
const KEY_BYTES = [251, 255, 190];
const ENDPOINT = "https://push.test/abc";

const UNAVAILABLE = "As notificações não estão disponíveis no momento.";
const ENABLE_FAILED = "Não foi possível ligar as notificações. Tente de novo.";
const DISABLE_FAILED = "Não foi possível desligar as notificações. Tente de novo.";

interface FakeSubscription {
  endpoint: string;
  options: { applicationServerKey: ArrayBuffer | null };
  toJSON: () => { endpoint: string; keys: { p256dh: string; auth: string } };
  unsubscribe: ReturnType<typeof vi.fn<() => Promise<boolean>>>;
}

function subscription(): FakeSubscription {
  return {
    endpoint: ENDPOINT,
    options: { applicationServerKey: new Uint8Array(KEY_BYTES).buffer },
    toJSON: () => ({ endpoint: ENDPOINT, keys: { p256dh: "P", auth: "A" } }),
    unsubscribe: vi.fn<() => Promise<boolean>>().mockResolvedValue(true),
  };
}

const requestPermission = vi.fn<() => Promise<NotificationPermission>>();
const getSubscription = vi.fn<() => Promise<FakeSubscription | null>>();
const subscribe = vi.fn<(options: PushSubscriptionOptionsInit) => Promise<FakeSubscription>>();
let permission: NotificationPermission = "default";

function supported(state: NotificationPermission): void {
  permission = state;
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
  const registration = { pushManager: { getSubscription, subscribe } };
  Object.defineProperty(navigator, "serviceWorker", {
    value: {
      getRegistration: () => Promise.resolve(registration),
      ready: Promise.resolve(registration),
    },
    configurable: true,
  });
}

beforeEach(() => {
  api.reset();
  permission = "default";
  requestPermission.mockReset().mockImplementation(() => {
    permission = "granted";
    return Promise.resolve(permission);
  });
  getSubscription.mockReset().mockResolvedValue(null);
  subscribe.mockReset().mockImplementation(() => Promise.resolve(subscription()));
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

describe("useDevicePush: first state", () => {
  it("is 'unsupported' in an ordinary browser without Notification", () => {
    const { result } = renderHook(() => useDevicePush());
    expect(result.current).toMatchObject({ permission: "unsupported", subscribed: false });
  });

  it("is 'needs-install' on an iPhone in a tab", () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(iPhone);
    const { result } = renderHook(() => useDevicePush());
    expect(result.current).toMatchObject({ permission: "needs-install", subscribed: false });
  });

  it.each(["default", "denied"] as const)("is '%s' and not subscribed", (state) => {
    supported(state);
    const { result } = renderHook(() => useDevicePush());
    expect(result.current).toMatchObject({ permission: state, subscribed: false });
    expect(getSubscription).not.toHaveBeenCalled();
  });

  it("reads an existing subscription when granted", async () => {
    supported("granted");
    getSubscription.mockResolvedValue(subscription());
    const { result } = renderHook(() => useDevicePush());
    expect(result.current.subscribed).toBeNull();
    await waitFor(() => {
      expect(result.current.subscribed).toBe(true);
    });
  });

  it("is not subscribed when granted without a subscription", async () => {
    supported("granted");
    const { result } = renderHook(() => useDevicePush());
    expect(result.current.subscribed).toBeNull();
    await waitFor(() => {
      expect(result.current.subscribed).toBe(false);
    });
  });

  it("counts a failed read as not subscribed", async () => {
    supported("granted");
    getSubscription.mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => useDevicePush());
    await waitFor(() => {
      expect(result.current.subscribed).toBe(false);
    });
  });
});

describe("useDevicePush: enable", () => {
  it("does nothing when unsupported", async () => {
    const { result } = renderHook(() => useDevicePush());
    await act(() => result.current.enable());
    expect(requestPermission).not.toHaveBeenCalled();
    expect(api.sent).toHaveLength(0);
    expect(result.current.pending).toBe(false);
  });

  it("does nothing when the app must be installed first", async () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(iPhone);
    const { result } = renderHook(() => useDevicePush());
    await act(() => result.current.enable());
    expect(requestPermission).not.toHaveBeenCalled();
    expect(api.sent).toHaveLength(0);
  });

  it("does nothing when denied", async () => {
    supported("denied");
    const { result } = renderHook(() => useDevicePush());
    await act(() => result.current.enable());
    expect(requestPermission).not.toHaveBeenCalled();
    expect(api.sent).toHaveLength(0);
  });

  it("asks first, then fetches the key, subscribes and saves", async () => {
    supported("default");
    api.answer(200, { public_key: KEY });
    api.answer(200, { endpoint: ENDPOINT });
    const { result } = renderHook(() => useDevicePush());

    await act(() => result.current.enable());

    expect(requestPermission).toHaveBeenCalledOnce();
    expect(requestPermission.mock.invocationCallOrder[0]).toBeLessThan(
      subscribe.mock.invocationCallOrder[0] ?? 0,
    );
    expect(api.sent.map((request) => `${request.method} ${request.path}`)).toEqual([
      "GET /api/push/public-key",
      "PUT /api/push/subscriptions",
    ]);
    expect(subscribe.mock.calls[0]?.[0].userVisibleOnly).toBe(true);
    expect(api.last().body).toEqual({ endpoint: ENDPOINT, keys: { p256dh: "P", auth: "A" } });
    expect(result.current).toMatchObject({
      permission: "granted",
      subscribed: true,
      pending: false,
      error: null,
    });
  });

  it("makes no request when the person refuses", async () => {
    supported("default");
    requestPermission.mockImplementation(() => {
      permission = "denied";
      return Promise.resolve(permission);
    });
    const { result } = renderHook(() => useDevicePush());

    await act(() => result.current.enable());

    expect(api.sent).toHaveLength(0);
    expect(result.current).toMatchObject({ permission: "denied", subscribed: false, error: null });
  });

  it("says push is unavailable when the server has it off", async () => {
    supported("default");
    api.answer(503, { detail: "Notificações desligadas." });
    const { result } = renderHook(() => useDevicePush());

    await act(() => result.current.enable());

    expect(result.current.error).toBe(UNAVAILABLE);
    expect(result.current.subscribed).not.toBe(true);
    expect(subscribe).not.toHaveBeenCalled();
    expect(result.current.pending).toBe(false);
  });

  it("fails when the PUT echoes another endpoint", async () => {
    supported("default");
    api.answer(200, { public_key: KEY });
    api.answer(200, { endpoint: "https://push.test/other" });
    const { result } = renderHook(() => useDevicePush());

    await act(() => result.current.enable());

    expect(result.current.error).toBe(ENABLE_FAILED);
    expect(result.current.subscribed).not.toBe(true);
  });

  it("fails when the PUT answers the SPA's fallback page", async () => {
    supported("default");
    api.answer(200, { public_key: KEY });
    api.answerText(200, "<!doctype html><html></html>");
    const { result } = renderHook(() => useDevicePush());

    await act(() => result.current.enable());

    expect(result.current.error).toBe(ENABLE_FAILED);
    expect(result.current.subscribed).not.toBe(true);
  });

  it("shows the API's sentence when the account is held", async () => {
    supported("default");
    api.answer(200, { public_key: KEY });
    api.answer(403, { detail: "Confirme seu e-mail.", required_action: "confirm_email" });
    const { result } = renderHook(() => useDevicePush());

    await act(() => result.current.enable());

    expect(result.current.error).toBe("Confirme seu e-mail.");
    expect(result.current.subscribed).not.toBe(true);
  });

  it("reuses a subscription that already exists for the key and saves it", async () => {
    supported("granted");
    getSubscription.mockResolvedValue(subscription());
    api.answer(200, { public_key: KEY });
    api.answer(200, { endpoint: ENDPOINT });
    const { result } = renderHook(() => useDevicePush());
    await waitFor(() => {
      expect(result.current.subscribed).toBe(true);
    });

    await act(() => result.current.enable());

    expect(subscribe).not.toHaveBeenCalled();
    expect(api.sentTo("PUT", "/api/push/subscriptions")).toHaveLength(1);
    expect(result.current).toMatchObject({ subscribed: true, error: null });
  });

  it("is pending while it runs and ignores a second call meanwhile", async () => {
    supported("default");
    let release: (value: NotificationPermission) => void = () => undefined;
    requestPermission.mockImplementation(
      () =>
        new Promise<NotificationPermission>((resolve) => {
          release = (value) => {
            permission = value;
            resolve(value);
          };
        }),
    );
    api.answer(200, { public_key: KEY });
    api.answer(200, { endpoint: ENDPOINT });
    const { result } = renderHook(() => useDevicePush());

    let first: Promise<void> = Promise.resolve();
    let second: Promise<void> = Promise.resolve();
    act(() => {
      first = result.current.enable();
      second = result.current.enable();
    });
    expect(result.current.pending).toBe(true);
    expect(requestPermission).toHaveBeenCalledOnce();

    await act(async () => {
      release("granted");
      await Promise.all([first, second]);
    });

    expect(result.current.pending).toBe(false);
    expect(api.sentTo("PUT", "/api/push/subscriptions")).toHaveLength(1);
  });
});

describe("useDevicePush: disable", () => {
  it("cancels in the browser, then forgets the endpoint on the server", async () => {
    supported("granted");
    const existing = subscription();
    getSubscription.mockResolvedValue(existing);
    api.answerEmpty(204);
    const { result } = renderHook(() => useDevicePush());
    await waitFor(() => {
      expect(result.current.subscribed).toBe(true);
    });

    await act(() => result.current.disable());

    expect(existing.unsubscribe).toHaveBeenCalledOnce();
    expect(api.last()).toMatchObject({
      method: "DELETE",
      path: "/api/push/subscriptions",
      body: { endpoint: ENDPOINT },
    });
    expect(result.current).toMatchObject({ subscribed: false, pending: false, error: null });
  });

  it("is off even when the API fails after the browser let go", async () => {
    supported("granted");
    getSubscription.mockResolvedValue(subscription());
    api.answerText(502, "<html>Bad Gateway</html>");
    const { result } = renderHook(() => useDevicePush());
    await waitFor(() => {
      expect(result.current.subscribed).toBe(true);
    });

    await act(() => result.current.disable());

    expect(result.current.error).toBe(DISABLE_FAILED);
    expect(result.current.subscribed).toBe(false);
  });

  it("makes no request when the device held no subscription", async () => {
    supported("granted");
    const { result } = renderHook(() => useDevicePush());
    await waitFor(() => {
      expect(result.current.subscribed).toBe(false);
    });

    await act(() => result.current.disable());

    expect(api.sent).toHaveLength(0);
    expect(result.current.error).toBeNull();
  });
});
