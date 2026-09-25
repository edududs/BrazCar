import { afterEach, describe, expect, it, vi } from "vitest";

import * as resilient from "@/shared/adapters/resilient-event-source";

import { subscribeToBoardSignal } from "./board-signal-source";

vi.mock("@/shared/adapters/resilient-event-source");

const mocked = vi.mocked(resilient);

afterEach(() => {
  vi.resetAllMocks();
});

describe("subscribeToBoardSignal", () => {
  it("opens an event source on the signal route, without credentials", () => {
    const close = vi.fn();
    mocked.openResilientEventSource.mockReturnValue({ close, reconnect: vi.fn() });
    subscribeToBoardSignal(vi.fn());

    const options = mocked.openResilientEventSource.mock.calls[0]?.[0];
    expect(options?.url).toMatch(/\/api\/rides\/signal$/);
    expect(options?.withCredentials).toBe(false);
    expect(options?.events).toEqual(["revision", "ping"]);
  });

  it("hands the revision number out of a 'revision' message", () => {
    let capturedOnMessage: ((message: { event: string; data: string }) => void) | undefined;
    mocked.openResilientEventSource.mockImplementation((options) => {
      capturedOnMessage = options.onMessage;
      return { close: vi.fn(), reconnect: vi.fn() };
    });
    const onRevision = vi.fn();
    subscribeToBoardSignal(onRevision);

    capturedOnMessage?.({ event: "revision", data: JSON.stringify({ revision: 5 }) });
    expect(onRevision).toHaveBeenCalledWith(5);
  });

  it("ignores anything that is not a 'revision' message, or a malformed one", () => {
    let capturedOnMessage: ((message: { event: string; data: string }) => void) | undefined;
    mocked.openResilientEventSource.mockImplementation((options) => {
      capturedOnMessage = options.onMessage;
      return { close: vi.fn(), reconnect: vi.fn() };
    });
    const onRevision = vi.fn();
    subscribeToBoardSignal(onRevision);

    capturedOnMessage?.({ event: "ping", data: "" });
    capturedOnMessage?.({ event: "revision", data: JSON.stringify({ nothing: "here" }) });
    expect(onRevision).not.toHaveBeenCalled();
  });

  it("closes through to the underlying source", () => {
    const close = vi.fn();
    mocked.openResilientEventSource.mockReturnValue({ close, reconnect: vi.fn() });
    const subscription = subscribeToBoardSignal(vi.fn());
    subscription.close();
    expect(close).toHaveBeenCalled();
  });
});
