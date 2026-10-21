// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { currentPushSubscription, subscribeToPush, unsubscribeFromPush } from "./web-push";

/** base64url of the bytes 251, 255, 190: the alphabet's `-` and `_` slots, no padding needed. */
const KEY = "-_--";
const KEY_BYTES = [251, 255, 190];
/** base64url of 1, 2: two bytes, so the padding has to be restored. */
const SHORT_KEY = "AQI";

interface FakeSubscription {
  endpoint: string;
  options: { applicationServerKey: ArrayBuffer | null };
  toJSON: () => { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  unsubscribe: ReturnType<typeof vi.fn<() => Promise<boolean>>>;
}

function subscription(
  keyBytes: number[] | null,
  json?: ReturnType<FakeSubscription["toJSON"]>,
): FakeSubscription {
  return {
    endpoint: "https://push.test/abc",
    options: { applicationServerKey: keyBytes ? new Uint8Array(keyBytes).buffer : null },
    toJSON: () => json ?? { endpoint: "https://push.test/abc", keys: { p256dh: "P", auth: "A" } },
    unsubscribe: vi.fn<() => Promise<boolean>>().mockResolvedValue(true),
  };
}

const getSubscription = vi.fn<() => Promise<FakeSubscription | null>>();
const subscribe = vi.fn<(options: PushSubscriptionOptionsInit) => Promise<FakeSubscription>>();
const getRegistration = vi.fn<() => Promise<unknown>>();
let ready: Promise<unknown>;

beforeEach(() => {
  getSubscription.mockReset().mockResolvedValue(null);
  subscribe.mockReset().mockResolvedValue(subscription(KEY_BYTES));
  const registration = { pushManager: { getSubscription, subscribe } };
  getRegistration.mockReset().mockResolvedValue(registration);
  ready = Promise.resolve(registration);
  Object.defineProperty(navigator, "serviceWorker", {
    value: {
      getRegistration,
      get ready() {
        return ready;
      },
    },
    configurable: true,
  });
});

afterEach(() => {
  vi.useRealTimers();
  Reflect.deleteProperty(navigator, "serviceWorker");
});

describe("currentPushSubscription", () => {
  it("is null at once when there is no registration, as in `yarn dev`", async () => {
    getRegistration.mockResolvedValue(undefined);
    await expect(currentPushSubscription()).resolves.toBeNull();
  });

  it("is null when the registration holds no subscription", async () => {
    await expect(currentPushSubscription()).resolves.toBeNull();
  });

  it("reads the existing subscription", async () => {
    getSubscription.mockResolvedValue(subscription(KEY_BYTES));
    await expect(currentPushSubscription()).resolves.toEqual({
      endpoint: "https://push.test/abc",
      keys: { p256dh: "P", auth: "A" },
    });
  });
});

describe("subscribeToPush", () => {
  it("subscribes visibly with the key's bytes when there is no subscription", async () => {
    await expect(subscribeToPush(KEY)).resolves.toEqual({
      endpoint: "https://push.test/abc",
      keys: { p256dh: "P", auth: "A" },
    });

    const options = subscribe.mock.calls[0]?.[0];
    expect(options?.userVisibleOnly).toBe(true);
    expect(Array.from(options?.applicationServerKey as Uint8Array)).toEqual(KEY_BYTES);
  });

  it("restores the padding of a short key", async () => {
    await subscribeToPush(SHORT_KEY);
    expect(Array.from(subscribe.mock.calls[0]?.[0].applicationServerKey as Uint8Array)).toEqual([
      1, 2,
    ]);
  });

  it("reuses a subscription made with the same key", async () => {
    const existing = subscription(KEY_BYTES);
    getSubscription.mockResolvedValue(existing);

    await subscribeToPush(KEY);

    expect(subscribe).not.toHaveBeenCalled();
    expect(existing.unsubscribe).not.toHaveBeenCalled();
  });

  it("reuses a subscription that does not say which key it used", async () => {
    getSubscription.mockResolvedValue(subscription(null));

    await subscribeToPush(KEY);

    expect(subscribe).not.toHaveBeenCalled();
  });

  it("replaces a subscription made with another key", async () => {
    const stale = subscription([1, 2, 3]);
    getSubscription.mockResolvedValue(stale);

    await subscribeToPush(KEY);

    expect(stale.unsubscribe).toHaveBeenCalledOnce();
    expect(subscribe).toHaveBeenCalledOnce();
  });

  it("replaces a subscription whose key has another length", async () => {
    const stale = subscription([251, 255]);
    getSubscription.mockResolvedValue(stale);

    await subscribeToPush(KEY);

    expect(stale.unsubscribe).toHaveBeenCalledOnce();
  });

  it("rejects when no service worker ever becomes ready", async () => {
    vi.useFakeTimers();
    ready = new Promise(() => undefined);

    const attempt = subscribeToPush(KEY);
    const assertion = expect(attempt).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(5000);

    await assertion;
    expect(subscribe).not.toHaveBeenCalled();
  });

  it.each([
    ["an endpoint", { keys: { p256dh: "P", auth: "A" } }],
    ["keys", { endpoint: "https://push.test/abc" }],
    ["a p256dh", { endpoint: "https://push.test/abc", keys: { auth: "A" } }],
    ["an auth", { endpoint: "https://push.test/abc", keys: { p256dh: "P" } }],
  ])("rejects a subscription without %s", async (_name, json) => {
    subscribe.mockResolvedValue(subscription(KEY_BYTES, json));

    await expect(subscribeToPush(KEY)).rejects.toThrow();
  });
});

describe("unsubscribeFromPush", () => {
  it("cancels the subscription and returns its endpoint", async () => {
    const existing = subscription(KEY_BYTES);
    getSubscription.mockResolvedValue(existing);

    await expect(unsubscribeFromPush()).resolves.toBe("https://push.test/abc");
    expect(existing.unsubscribe).toHaveBeenCalledOnce();
  });

  it("returns null when there was nothing to cancel", async () => {
    await expect(unsubscribeFromPush()).resolves.toBeNull();
  });
});
