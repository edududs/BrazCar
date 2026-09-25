// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** What Workbox would do, played by the test: the callbacks it was given and the activation. */
const workbox = vi.hoisted(() => ({
  options: null as null | {
    onNeedRefresh?: () => void;
    onRegisteredSW?: (url: string, registration: ServiceWorkerRegistration | undefined) => void;
  },
  activate: vi.fn<(reloadPage: boolean) => Promise<void>>(() => Promise.resolve()),
}));

vi.mock("virtual:pwa-register", () => ({
  registerSW: (options: NonNullable<typeof workbox.options>) => {
    workbox.options = options;
    return workbox.activate;
  },
}));

type Worker = typeof import("./service-worker");

const reload = vi.fn();
const update = vi.fn(() => Promise.resolve());

/** A fresh copy of the module, since it keeps its state for the whole page. */
async function load(): Promise<Worker> {
  vi.resetModules();
  return import("./service-worker");
}

beforeEach(() => {
  workbox.options = null;
  workbox.activate.mockClear();
  reload.mockClear();
  update.mockClear();
  vi.stubEnv("PROD", true);
  Object.defineProperty(navigator, "serviceWorker", { value: {}, configurable: true });
  vi.spyOn(window, "location", "get").mockReturnValue({ reload } as unknown as Location);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  Reflect.deleteProperty(navigator, "serviceWorker");
});

function registered(check = update) {
  const options = workbox.options;
  if (options === null) throw new Error("The worker was not registered.");
  options.onRegisteredSW?.("/sw.js", { update: check } as unknown as ServiceWorkerRegistration);
  return options;
}

describe("registerServiceWorker", () => {
  it("does nothing in development", async () => {
    vi.stubEnv("PROD", false);
    const worker = await load();

    worker.registerServiceWorker();

    expect(workbox.options).toBeNull();
  });

  it("does nothing where the browser has no service worker", async () => {
    Reflect.deleteProperty(navigator, "serviceWorker");
    const worker = await load();

    worker.registerServiceWorker();

    expect(workbox.options).toBeNull();
  });

  it("a new build waiting is told to every subscriber, until they leave", async () => {
    const worker = await load();
    worker.registerServiceWorker();
    const options = registered();
    const onChange = vi.fn();
    const stop = worker.subscribeToUpdateWaiting(onChange);

    expect(worker.readUpdateWaiting()).toBe(false);
    options.onNeedRefresh?.();
    stop();
    options.onNeedRefresh?.();

    expect(worker.readUpdateWaiting()).toBe(true);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("looks for a new build whenever the installed app comes back into view", async () => {
    const worker = await load();
    worker.registerServiceWorker();
    // Its own check: copies of the module loaded by earlier tests still listen on the document.
    const check = vi.fn(() => Promise.resolve());
    registered(check);
    const visibility = vi.spyOn(document, "visibilityState", "get");

    visibility.mockReturnValue("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    visibility.mockReturnValue("visible");
    document.dispatchEvent(new Event("visibilitychange"));

    expect(check).toHaveBeenCalledTimes(1);
  });
});

describe("applyUpdate", () => {
  it("with a build waiting, it takes over at once and lets Workbox reload", async () => {
    const worker = await load();
    worker.registerServiceWorker();
    registered().onNeedRefresh?.();

    await worker.applyUpdate();

    expect(workbox.activate).toHaveBeenCalledWith(true);
    expect(update).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it("with nothing waiting yet, it looks for a build and takes over when it arrives", async () => {
    const worker = await load();
    worker.registerServiceWorker();
    const options = registered();
    update.mockImplementationOnce(() => {
      options.onNeedRefresh?.();
      return Promise.resolve();
    });

    await worker.applyUpdate();

    expect(update).toHaveBeenCalledTimes(1);
    expect(workbox.activate).toHaveBeenCalledWith(true);
  });

  it("waits for a build still installing after the check", async () => {
    vi.useFakeTimers();
    const worker = await load();
    worker.registerServiceWorker();
    const options = registered();

    const applying = worker.applyUpdate();
    await vi.advanceTimersByTimeAsync(4000);
    options.onNeedRefresh?.();
    await applying;

    expect(workbox.activate).toHaveBeenCalledWith(true);
    expect(reload).not.toHaveBeenCalled();
  });

  it("when no build shows up in ten seconds, it plainly reloads", async () => {
    vi.useFakeTimers();
    const worker = await load();
    worker.registerServiceWorker();
    registered();

    const applying = worker.applyUpdate();
    await vi.advanceTimersByTimeAsync(10_000);
    await applying;

    expect(workbox.activate).not.toHaveBeenCalled();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("a failed check for a build is not fatal: it still reloads", async () => {
    vi.useFakeTimers();
    const worker = await load();
    worker.registerServiceWorker();
    registered();
    update.mockImplementationOnce(() => Promise.reject(new Error("offline")));

    const applying = worker.applyUpdate();
    await vi.advanceTimersByTimeAsync(10_000);
    await applying;

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("without a worker at all (development), it just reloads", async () => {
    vi.stubEnv("PROD", false);
    const worker = await load();
    worker.registerServiceWorker();

    await worker.applyUpdate();

    expect(reload).toHaveBeenCalledTimes(1);
  });
});
