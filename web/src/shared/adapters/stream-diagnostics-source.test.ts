// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FakeEventSource, installFakeEventSource } from "@/shared/testing/fake-event-source";

import type { StreamDiagnosticsSettings } from "../domain/stream-diagnostics";
import type { ResilientEventSource } from "./resilient-event-source";
import { type DiagnosticMessage, openStreamDiagnostics } from "./stream-diagnostics-source";

const settings: StreamDiagnosticsSettings = {
  token: "t0k",
  tickSeconds: 5,
  heartbeatSeconds: 15,
  heartbeatKind: "event",
  silenceLimitMs: 35_000,
  resumeGraceMs: 3000,
};

let opened: ResilientEventSource | null = null;

beforeEach(() => {
  vi.useFakeTimers();
  installFakeEventSource();
});

afterEach(() => {
  opened?.close();
  opened = null;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("openStreamDiagnostics", () => {
  it("opens the diagnostics route with the settings in the query, and with the cookie", () => {
    opened = openStreamDiagnostics(settings, { onMessage: vi.fn(), onLifecycle: vi.fn() });

    const connection = FakeEventSource.latest();
    const url = new URL(connection.url, "https://front.test");
    expect(url.pathname).toBe("/api/diagnostics/sse");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      token: "t0k",
      tick_seconds: "5",
      heartbeat_seconds: "15",
      heartbeat_kind: "event",
    });
    expect(connection.init).toEqual({ withCredentials: true });
  });

  it("reads a tick with its number and a ping as a heartbeat", () => {
    const received: DiagnosticMessage[] = [];
    opened = openStreamDiagnostics(settings, {
      onMessage: (message) => received.push(message),
      onLifecycle: vi.fn(),
    });

    FakeEventSource.latest().send("tick", '{"seq":1,"server_time_ms":1000}');
    FakeEventSource.latest().send("ping", '{"server_time_ms":2000}');

    expect(received).toEqual([
      { kind: "tick", seq: 1, serverTimeMs: 1000 },
      { kind: "heartbeat", serverTimeMs: 2000 },
    ]);
  });

  it("a payload without its numbers is refused loudly, it is a test instrument", () => {
    opened = openStreamDiagnostics(settings, { onMessage: vi.fn(), onLifecycle: vi.fn() });

    expect(() => {
      FakeEventSource.latest().send("tick", '{"server_time_ms":1000}');
    }).toThrow('missing the number "seq"');
    expect(() => {
      FakeEventSource.latest().send("ping", '{"server_time_ms":"soon"}');
    }).toThrow('missing the number "server_time_ms"');
  });

  it("passes the connection's life on to the page", () => {
    const onLifecycle = vi.fn();
    opened = openStreamDiagnostics(settings, { onMessage: vi.fn(), onLifecycle });

    FakeEventSource.latest().open();

    expect(onLifecycle).toHaveBeenLastCalledWith({ kind: "open" });
  });
});
