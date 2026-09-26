// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FakeEventSource, installFakeEventSource } from "@/shared/testing/fake-event-source";

import { type BoardSignalSubscription, subscribeToBoardSignal } from "./board-signal-source";

let subscription: BoardSignalSubscription | null = null;

beforeEach(() => {
  vi.useFakeTimers();
  installFakeEventSource();
});

afterEach(() => {
  subscription?.close();
  subscription = null;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("subscribeToBoardSignal", () => {
  it("listens to the board's signal route without the cookie", () => {
    subscription = subscribeToBoardSignal(vi.fn());

    expect(FakeEventSource.latest().url).toMatch(/\/api\/rides\/signal$/);
    expect(FakeEventSource.latest().init).toEqual({ withCredentials: false });
  });

  it("hands on every revision number, and nothing for a ping", () => {
    const onRevision = vi.fn();
    subscription = subscribeToBoardSignal(onRevision);
    const connection = FakeEventSource.latest();

    connection.send("revision", '{"revision":3}');
    connection.send("ping", "{}");
    connection.send("revision", '{"revision":4}');

    expect(onRevision.mock.calls).toEqual([[3], [4]]);
  });

  it("ignores a revision frame without a number instead of passing garbage on", () => {
    const onRevision = vi.fn();
    subscription = subscribeToBoardSignal(onRevision);
    const connection = FakeEventSource.latest();

    connection.send("revision", '{"revision":"3"}');
    connection.send("revision", "{}");
    connection.send("revision", "null");

    expect(onRevision).not.toHaveBeenCalled();
  });

  it("closing closes the connection", () => {
    subscription = subscribeToBoardSignal(vi.fn());

    subscription.close();

    expect(FakeEventSource.latest().closed).toBe(true);
  });
});
