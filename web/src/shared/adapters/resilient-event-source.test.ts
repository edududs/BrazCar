// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FakeEventSource, installFakeEventSource } from "@/shared/testing/fake-event-source";

import type { ConnectionLifecycleEvent, SignalMessage } from "../domain/signal-connection";
import { type ResilientEventSource, openResilientEventSource } from "./resilient-event-source";

const SILENCE_MS = 35_000;
const GRACE_MS = 3000;

let visibility: DocumentVisibilityState = "visible";
let opened: ResilientEventSource | null = null;

function open(resumeGraceMs = GRACE_MS) {
  const messages: SignalMessage[] = [];
  const lifecycle: ConnectionLifecycleEvent[] = [];
  opened = openResilientEventSource({
    url: "https://api.test/api/rides/signal",
    withCredentials: false,
    events: ["revision", "ping"],
    silenceLimitMs: SILENCE_MS,
    resumeGraceMs,
    onMessage: (message) => messages.push(message),
    onLifecycle: (event) => lifecycle.push(event),
  });
  return { source: opened, messages, lifecycle };
}

function reasons(lifecycle: readonly ConnectionLifecycleEvent[]): string[] {
  return lifecycle.flatMap((event) => (event.kind === "connecting" ? [event.reason] : []));
}

function becomeVisible(state: DocumentVisibilityState) {
  visibility = state;
  document.dispatchEvent(new Event("visibilitychange", { bubbles: true }));
}

beforeEach(() => {
  vi.useFakeTimers();
  installFakeEventSource();
  visibility = "visible";
  vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility);
});

afterEach(() => {
  opened?.close();
  opened = null;
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("connecting", () => {
  it("opens one connection to the URL, with the credentials flag asked for", () => {
    const { lifecycle } = open();

    expect(FakeEventSource.opened).toHaveLength(1);
    expect(FakeEventSource.latest().url).toBe("https://api.test/api/rides/signal");
    expect(FakeEventSource.latest().init).toEqual({ withCredentials: false });
    expect(lifecycle).toEqual([{ kind: "connecting", reason: "start" }]);
  });

  it("reports the open, and passes on only the listed events with their data", () => {
    const { messages, lifecycle } = open();
    const connection = FakeEventSource.latest();

    connection.open();
    connection.send("revision", '{"revision":7}');
    connection.send("other", "ignored");
    connection.send("ping", "");

    expect(lifecycle.at(-1)).toEqual({ kind: "open" });
    expect(messages).toEqual([
      { event: "revision", data: '{"revision":7}' },
      { event: "ping", data: "" },
    ]);
  });

  it("closing stops listening and closes the connection for good", () => {
    const { source, lifecycle } = open();
    const connection = FakeEventSource.latest();

    source.close();
    vi.advanceTimersByTime(SILENCE_MS * 3);
    window.dispatchEvent(new Event("online"));

    expect(connection.closed).toBe(true);
    expect(FakeEventSource.opened).toHaveLength(1);
    expect(lifecycle).toHaveLength(1);
  });

  it("a manual reconnect replaces the connection", () => {
    const { source, lifecycle } = open();
    const first = FakeEventSource.latest();

    source.reconnect();

    expect(first.closed).toBe(true);
    expect(FakeEventSource.opened).toHaveLength(2);
    expect(reasons(lifecycle)).toEqual(["start", "manual"]);
  });
});

describe("the silence watchdog", () => {
  it("reconnects after the silence limit with nothing received", () => {
    const { lifecycle } = open();
    FakeEventSource.latest().open();

    vi.advanceTimersByTime(SILENCE_MS - 1);
    expect(FakeEventSource.opened).toHaveLength(1);
    vi.advanceTimersByTime(1);

    expect(FakeEventSource.opened).toHaveLength(2);
    expect(FakeEventSource.opened[0]?.closed).toBe(true);
    expect(reasons(lifecycle)).toEqual(["start", "silence"]);
  });

  it("every event received restarts the count", () => {
    open();
    const connection = FakeEventSource.latest();
    connection.open();

    vi.advanceTimersByTime(SILENCE_MS - 1000);
    connection.send("ping", "");
    vi.advanceTimersByTime(SILENCE_MS - 1000);

    expect(FakeEventSource.opened).toHaveLength(1);
  });
});

describe("errors", () => {
  it("while the browser retries by itself, it only reports and does not pile a second connection", () => {
    const { lifecycle } = open();
    const connection = FakeEventSource.latest();
    connection.open();

    connection.fail(true);
    vi.advanceTimersByTime(5000);

    expect(lifecycle.at(-1)).toEqual({ kind: "error", readyState: "connecting" });
    expect(FakeEventSource.opened).toHaveLength(1);
  });

  it("when the browser gives up, it tries again after three seconds", () => {
    const { lifecycle } = open();
    const connection = FakeEventSource.latest();

    connection.fail(false);
    expect(lifecycle.at(-1)).toEqual({ kind: "error", readyState: "closed" });
    vi.advanceTimersByTime(2999);
    expect(FakeEventSource.opened).toHaveLength(1);
    vi.advanceTimersByTime(1);

    expect(FakeEventSource.opened).toHaveLength(2);
    expect(reasons(lifecycle)).toEqual(["start", "closed-by-error"]);
  });
});

describe("resuming (ADR-0013)", () => {
  it("doubts an open connection when the page comes back, and keeps it if an event proves it alive", () => {
    const { lifecycle } = open();
    const connection = FakeEventSource.latest();
    connection.open();

    vi.advanceTimersByTime(1000);
    becomeVisible("visible");
    expect(lifecycle.at(-1)).toEqual({
      kind: "environment",
      change: "visible",
      readyState: "open",
      silentForMs: 1000,
    });
    vi.advanceTimersByTime(500);
    connection.send("ping", "");

    expect(lifecycle.at(-1)).toEqual({ kind: "survived", trigger: "visible", afterMs: 500 });
    vi.advanceTimersByTime(GRACE_MS);
    expect(FakeEventSource.opened).toHaveLength(1);
  });

  it("replaces a connection that stays quiet through the grace period", () => {
    const { lifecycle } = open();
    FakeEventSource.latest().open();

    window.dispatchEvent(new Event("online"));
    vi.advanceTimersByTime(GRACE_MS);

    expect(FakeEventSource.opened).toHaveLength(2);
    expect(reasons(lifecycle)).toEqual(["start", "resume-grace-expired"]);
  });

  it("an error during the grace period means it was dead all along: reconnect at once", () => {
    const { lifecycle } = open();
    const connection = FakeEventSource.latest();
    connection.open();

    window.dispatchEvent(new Event("pageshow"));
    connection.fail(true);

    expect(FakeEventSource.opened).toHaveLength(2);
    expect(reasons(lifecycle)).toEqual(["start", "dead-on-resume"]);
  });

  it("with no grace period, a resume reconnects at once", () => {
    const { lifecycle } = open(0);
    FakeEventSource.latest().open();

    window.dispatchEvent(new Event("online"));

    expect(reasons(lifecycle)).toEqual(["start", "resume-grace-expired"]);
  });

  it("a burst of wake-up events doubts once, not once per event", () => {
    const { lifecycle } = open();
    FakeEventSource.latest().open();

    becomeVisible("visible");
    window.dispatchEvent(new Event("pageshow"));
    window.dispatchEvent(new Event("online"));
    vi.advanceTimersByTime(GRACE_MS);

    expect(FakeEventSource.opened).toHaveLength(2);
    expect(reasons(lifecycle)).toEqual(["start", "resume-grace-expired"]);
  });

  it("does not doubt a connection that is still connecting: the browser is already on it", () => {
    open();

    window.dispatchEvent(new Event("online"));
    vi.advanceTimersByTime(GRACE_MS);

    expect(FakeEventSource.opened).toHaveLength(1);
  });

  it("going away is only reported, never a reconnect", () => {
    const { lifecycle } = open();
    FakeEventSource.latest().open();

    becomeVisible("hidden");
    window.dispatchEvent(new Event("offline"));
    window.dispatchEvent(new Event("pagehide"));
    vi.advanceTimersByTime(GRACE_MS);

    expect(
      lifecycle.flatMap((event) => (event.kind === "environment" ? [event.change] : [])),
    ).toEqual(["hidden", "offline", "pagehide"]);
    expect(FakeEventSource.opened).toHaveLength(1);
  });

  it("a manual reconnect during the grace period cancels the pending doubt", () => {
    const { source, lifecycle } = open();
    FakeEventSource.latest().open();

    window.dispatchEvent(new Event("online"));
    source.reconnect();
    vi.advanceTimersByTime(GRACE_MS);

    expect(reasons(lifecycle)).toEqual(["start", "manual"]);
  });
});
