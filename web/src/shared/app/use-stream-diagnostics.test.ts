// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FakeEventSource, installFakeEventSource } from "@/shared/testing/fake-event-source";

import { copyText, shareText } from "../adapters/text-export";
import type { StreamDiagnosticsSettings } from "../domain/stream-diagnostics";
import { useStreamDiagnostics } from "./use-stream-diagnostics";

vi.mock("../adapters/text-export");

const settings: StreamDiagnosticsSettings = {
  token: "segredo",
  tickSeconds: 1,
  heartbeatSeconds: 15,
  heartbeatKind: "event",
  silenceLimitMs: 35_000,
  resumeGraceMs: 3000,
};

const START = new Date("2026-09-23T07:00:00-03:00").getTime();

function texts(log: readonly { text: string }[]): string[] {
  return log.map((entry) => entry.text);
}

function tick(seq: number, serverTimeMs: number) {
  act(() => {
    FakeEventSource.latest().send("tick", JSON.stringify({ seq, server_time_ms: serverTimeMs }));
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(START);
  installFakeEventSource();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("useStreamDiagnostics", () => {
  it("logs the connection's life and counts connections", () => {
    const { result } = renderHook(() => useStreamDiagnostics(settings));

    expect(result.current.readyState).toBe("connecting");
    act(() => {
      FakeEventSource.latest().open();
    });

    expect(result.current.readyState).toBe("open");
    expect(result.current.connections).toBe(1);
    expect(texts(result.current.log)).toEqual(["conectando (motivo: start)", "conexão aberta"]);
    expect(result.current.log.map((entry) => entry.tone)).toEqual(["neutral", "positive"]);
  });

  it("measures the first event, the delay and the interval of each tick", () => {
    const { result } = renderHook(() => useStreamDiagnostics(settings));
    act(() => {
      FakeEventSource.latest().open();
    });

    vi.setSystemTime(START + 250);
    tick(1, START + 200);
    vi.setSystemTime(START + 1250);
    tick(2, START + 1200);

    expect(result.current.timeToFirstEventMs).toBe(250);
    expect(texts(result.current.log).slice(2)).toEqual([
      "primeiro evento da conexão 1 em 250ms",
      "#1 atraso 50ms intervalo —",
      "#2 atraso 50ms intervalo 1000ms",
    ]);
    expect(result.current.report.count).toBe(2);
    expect(result.current.report.missing).toBe(0);
  });

  it("counts a skipped sequence number as missing", () => {
    const { result } = renderHook(() => useStreamDiagnostics(settings));
    act(() => {
      FakeEventSource.latest().open();
    });

    tick(1, START);
    vi.setSystemTime(START + 2000);
    tick(3, START + 2000);

    expect(result.current.report.missing).toBe(1);
  });

  it("logs a heartbeat with its delay, and the environment and errors with their state", () => {
    const { result } = renderHook(() => useStreamDiagnostics(settings));
    act(() => {
      FakeEventSource.latest().open();
    });

    vi.setSystemTime(START + 100);
    act(() => {
      FakeEventSource.latest().send("ping", JSON.stringify({ server_time_ms: START + 60 }));
    });
    vi.setSystemTime(START + 1600);
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    act(() => {
      FakeEventSource.latest().fail(true);
    });

    expect(texts(result.current.log).slice(-3)).toEqual([
      "ping; atraso 40ms",
      "offline; readyState=open; sem evento há 1.5s",
      "erro; readyState=connecting",
    ]);
    expect(result.current.readyState).toBe("connecting");
  });

  it("notes when a resumed connection survives on its own", () => {
    const { result } = renderHook(() => useStreamDiagnostics(settings));
    act(() => {
      FakeEventSource.latest().open();
    });

    act(() => {
      window.dispatchEvent(new Event("pageshow"));
    });
    vi.setSystemTime(START + 120);
    tick(1, START + 100);

    expect(texts(result.current.log)).toContain(
      'sobreviveu a "pageshow": evento chegou sozinho em 120ms',
    );
  });

  it("marks numbered moments and clears the log but keeps the connection count", () => {
    const { result } = renderHook(() => useStreamDiagnostics(settings));
    act(() => {
      FakeEventSource.latest().open();
    });

    act(() => {
      result.current.mark();
    });
    act(() => {
      result.current.mark();
    });
    expect(texts(result.current.log).slice(-2)).toEqual(["=== MARCA 1 ===", "=== MARCA 2 ==="]);

    act(() => {
      result.current.clear();
    });
    expect(result.current.log).toEqual([]);
    expect(result.current.connections).toBe(1);
    expect(result.current.readyState).toBe("open");
  });

  it("reconnects by hand, as a new numbered connection", () => {
    const { result } = renderHook(() => useStreamDiagnostics(settings));

    act(() => {
      result.current.reconnect();
    });

    expect(result.current.connections).toBe(2);
    expect(texts(result.current.log).at(-1)).toBe("conectando (motivo: manual)");
  });

  it("copies a log that hides the token, and notes the result", async () => {
    vi.mocked(copyText).mockResolvedValue("copied");
    const { result } = renderHook(() => useStreamDiagnostics(settings));

    await act(async () => {
      result.current.copyLog();
      await Promise.resolve();
    });

    const exported = vi.mocked(copyText).mock.calls[0]?.[0] ?? "";
    expect(exported).toContain("BrazCar SSE diagnostics");
    expect(exported).toContain('"token":"***"');
    expect(exported).not.toContain("segredo");
    expect(exported).toContain("conectando (motivo: start)");
    expect(texts(result.current.log).at(-1)).toBe("log copiado");
  });

  it("shares the log and says so, or says the export failed", async () => {
    vi.mocked(shareText).mockResolvedValueOnce("shared").mockResolvedValueOnce("failed");
    const { result } = renderHook(() => useStreamDiagnostics(settings));

    await act(async () => {
      result.current.shareLog();
      await Promise.resolve();
    });
    expect(texts(result.current.log).at(-1)).toBe("log compartilhado");
    await act(async () => {
      result.current.shareLog();
      await Promise.resolve();
    });

    expect(texts(result.current.log).at(-1)).toBe("falha ao exportar");
    expect(vi.mocked(shareText).mock.calls[0]?.[0]).toBe("BrazCar SSE diagnostics");
  });

  it("closes the connection when the page goes", () => {
    const { unmount } = renderHook(() => useStreamDiagnostics(settings));

    unmount();

    expect(FakeEventSource.latest().closed).toBe(true);
  });

  it("formats the clock of an entry to the millisecond", () => {
    const { result } = renderHook(() => useStreamDiagnostics(settings));
    const at = new Date(2026, 8, 23, 7, 5, 9, 42).getTime();

    expect(result.current.formatClock(at)).toBe("07:05:09.042");
  });
});
