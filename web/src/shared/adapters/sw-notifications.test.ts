import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

import { beforeEach, describe, expect, it, vi } from "vitest";

const source = readFileSync(
  new URL("../../../public/sw-notifications.js", import.meta.url),
  "utf8",
);

interface FakeWindow {
  readonly url: string;
  readonly focus: () => Promise<unknown>;
  readonly navigate: (href: string) => Promise<unknown>;
}

type Handler = (event: unknown) => void;

const handlers = new Map<string, Handler>();
const showNotification = vi.fn<(title: string, options: unknown) => Promise<void>>();
const matchAll = vi.fn<(options: unknown) => Promise<FakeWindow[]>>();
const openWindow = vi.fn<(href: string) => Promise<unknown>>();

beforeEach(() => {
  handlers.clear();
  showNotification.mockReset().mockResolvedValue(undefined);
  matchAll.mockReset().mockResolvedValue([]);
  openWindow.mockReset().mockResolvedValue(undefined);
  const self = {
    addEventListener: (type: string, handler: Handler) => {
      handlers.set(type, handler);
    },
    registration: { scope: "https://brazcar.test/", showNotification },
    clients: { matchAll, openWindow },
  };
  runInNewContext(source, { self, URL });
});

/** Fires a push and returns the promise handed to `waitUntil`. */
function push(data: { json: () => unknown } | null): Promise<unknown> {
  const waitUntil = vi.fn<(promise: Promise<unknown>) => void>();
  handlers.get("push")?.({ data, waitUntil });
  expect(waitUntil).toHaveBeenCalledOnce();
  return waitUntil.mock.calls[0]?.[0] ?? Promise.reject(new Error("waitUntil got nothing"));
}

function click(url: unknown): { close: () => void; done: Promise<unknown> } {
  const close = vi.fn();
  const waitUntil = vi.fn<(promise: Promise<unknown>) => void>();
  handlers.get("notificationclick")?.({
    notification: { close, data: url === undefined ? undefined : { url } },
    waitUntil,
  });
  expect(waitUntil).toHaveBeenCalledOnce();
  return { close, done: waitUntil.mock.calls[0]?.[0] ?? Promise.resolve() };
}

const defaults = {
  body: "Toque para ver no BrazCar.",
  tag: "brazcar",
  icon: "/icon-192.png",
  data: { url: "/" },
};

function aWindow(url: string, navigate: FakeWindow["navigate"]): FakeWindow {
  return { url, focus: vi.fn().mockResolvedValue(undefined), navigate };
}

describe("push", () => {
  it("shows the title, body, tag, icon and url of a good payload", async () => {
    const payload = {
      title: "Nova carona",
      body: "Sai às 7h",
      tag: "alert-1",
      url: "/caronas/abc",
    };

    await push({ json: () => payload });

    expect(showNotification).toHaveBeenCalledWith("Nova carona", {
      body: "Sai às 7h",
      tag: "alert-1",
      icon: "/icon-192.png",
      data: { url: "/caronas/abc" },
    });
  });

  it("hands the notification's promise to waitUntil", async () => {
    let finish: () => void = () => undefined;
    showNotification.mockReturnValue(new Promise<void>((resolve) => (finish = resolve)));
    const pending = push({ json: () => ({}) });
    const settled = vi.fn();
    void pending.then(settled);
    await Promise.resolve();
    expect(settled).not.toHaveBeenCalled();
    finish();
    await pending;
    expect(settled).toHaveBeenCalled();
  });

  it.each([
    ["no data", null],
    [
      "unreadable JSON",
      {
        json: () => {
          throw new SyntaxError("bad");
        },
      },
    ],
    ["JSON that is not an object", { json: () => "text" }],
    ["JSON null", { json: () => null }],
    ["empty or non-string fields", { json: () => ({ title: "", body: 3, tag: null, url: {} }) }],
  ])("still shows the defaults for %s", async (_name, data) => {
    await push(data);

    expect(showNotification).toHaveBeenCalledWith("Apareceu carona", defaults);
  });
});

describe("notificationclick", () => {
  it("closes the notification", async () => {
    const { close, done } = click("/caronas/abc");
    await done;
    expect(close).toHaveBeenCalledOnce();
  });

  it("focuses an open window of the app and navigates it", async () => {
    const navigate = vi.fn().mockResolvedValue(undefined);
    const open = aWindow("https://brazcar.test/mural", navigate);
    matchAll.mockResolvedValue([aWindow("https://other.test/", vi.fn()), open]);

    await click("/caronas/abc").done;

    expect(matchAll).toHaveBeenCalledWith({ type: "window", includeUncontrolled: true });
    expect(open.focus).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith("https://brazcar.test/caronas/abc");
    expect(openWindow).not.toHaveBeenCalled();
  });

  it("opens a new window when none is open", async () => {
    await click("/caronas/abc").done;

    expect(openWindow).toHaveBeenCalledWith("https://brazcar.test/caronas/abc");
  });

  it("opens a new window when the open one cannot be navigated", async () => {
    const navigate = vi.fn().mockRejectedValue(new TypeError("not controlled"));
    matchAll.mockResolvedValue([aWindow("https://brazcar.test/", navigate)]);

    await click("/caronas/abc").done;

    expect(openWindow).toHaveBeenCalledWith("https://brazcar.test/caronas/abc");
  });

  it("never leaves the app: another origin goes to the root", async () => {
    await click("https://evil.test/phish").done;

    expect(openWindow).toHaveBeenCalledWith("https://brazcar.test/");
  });

  it("a notification without a url opens the root", async () => {
    await click(undefined).done;

    expect(openWindow).toHaveBeenCalledWith("https://brazcar.test/");
  });
});
