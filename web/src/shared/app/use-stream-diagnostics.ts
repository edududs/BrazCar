import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";

import { type DisplayMode, detectDisplayMode } from "../adapters/display-mode";
import type { ResilientEventSource } from "../adapters/resilient-event-source";
import {
  type DiagnosticMessage,
  openStreamDiagnostics,
} from "../adapters/stream-diagnostics-source";
import { type TextExportResult, copyText, shareText } from "../adapters/text-export";
import type { ConnectionLifecycleEvent, ConnectionReadyState } from "../domain/signal-connection";
import type { LogEntry, LogTone, StreamDiagnosticsSettings } from "../domain/stream-diagnostics";
import {
  type TimingReport,
  type TimingSummary,
  addReception,
  emptyTimingSummary,
  reportTiming,
} from "./stream-timing";

/** DIAGNOSTIC, removable with the backend route `/api/diagnostics/sse` (D-049). */

const LOG_LIMIT = 3000;

interface State {
  readonly readyState: ConnectionReadyState;
  readonly connections: number;
  readonly connectingAtMs: number | null;
  readonly timeToFirstEventMs: number | null;
  readonly summary: TimingSummary;
  readonly markers: number;
  readonly nextLogId: number;
  readonly log: readonly LogEntry[];
}

type Action =
  | { readonly type: "lifecycle"; readonly atMs: number; readonly event: ConnectionLifecycleEvent }
  | { readonly type: "message"; readonly atMs: number; readonly message: DiagnosticMessage }
  | { readonly type: "mark"; readonly atMs: number }
  | { readonly type: "note"; readonly atMs: number; readonly text: string }
  | { readonly type: "clear" };

const initialState: State = {
  readyState: "closed",
  connections: 0,
  connectingAtMs: null,
  timeToFirstEventMs: null,
  summary: emptyTimingSummary,
  markers: 0,
  nextLogId: 1,
  log: [],
};

function append(state: State, atMs: number, tone: LogTone, text: string): State {
  const entry: LogEntry = { id: state.nextLogId, atMs, tone, text };
  return { ...state, nextLogId: state.nextLogId + 1, log: [...state.log, entry].slice(-LOG_LIMIT) };
}

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

function describeLifecycle(event: ConnectionLifecycleEvent): { tone: LogTone; text: string } {
  switch (event.kind) {
    case "connecting":
      return { tone: "neutral", text: `conectando (motivo: ${event.reason})` };
    case "open":
      return { tone: "positive", text: "conexão aberta" };
    case "error":
      return { tone: "critical", text: `erro; readyState=${event.readyState}` };
    case "environment":
      return {
        tone: "marker",
        text: `${event.change}; readyState=${event.readyState}; sem evento há ${seconds(event.silentForMs)}`,
      };
    case "survived":
      return {
        tone: "positive",
        text: `sobreviveu a "${event.trigger}": evento chegou sozinho em ${String(event.afterMs)}ms`,
      };
  }
}

function reduceLifecycle(state: State, atMs: number, event: ConnectionLifecycleEvent): State {
  const { tone, text } = describeLifecycle(event);
  const logged = append(state, atMs, tone, text);
  switch (event.kind) {
    case "connecting":
      return {
        ...logged,
        readyState: "connecting",
        connections: state.connections + 1,
        connectingAtMs: atMs,
      };
    case "open":
      return { ...logged, readyState: "open" };
    case "error":
    case "environment":
      return { ...logged, readyState: event.readyState };
    case "survived":
      return logged;
  }
}

function reduceMessage(
  state: State,
  atMs: number,
  message: DiagnosticMessage,
  expectedIntervalMs: number,
): State {
  const first = state.connectingAtMs === null ? null : atMs - state.connectingAtMs;
  const timed: State =
    first === null
      ? state
      : append(
          { ...state, connectingAtMs: null, timeToFirstEventMs: first },
          atMs,
          "positive",
          `primeiro evento da conexão ${String(state.connections)} em ${String(first)}ms`,
        );
  const delay = atMs - message.serverTimeMs;
  if (message.kind === "heartbeat") {
    return append(timed, atMs, "neutral", `ping; atraso ${String(delay)}ms`);
  }
  const previous = timed.summary.last;
  const interval =
    previous !== null && previous.connection === timed.connections
      ? `${String(atMs - previous.receivedAtMs)}ms`
      : "—";
  const summary = addReception(
    timed.summary,
    {
      connection: timed.connections,
      seq: message.seq,
      serverTimeMs: message.serverTimeMs,
      receivedAtMs: atMs,
    },
    expectedIntervalMs,
  );
  return append(
    { ...timed, summary },
    atMs,
    "neutral",
    `#${String(message.seq)} atraso ${String(delay)}ms intervalo ${interval}`,
  );
}

function formatClock(atMs: number): string {
  const date = new Date(atMs);
  const pad = (value: number, size = 2) => String(value).padStart(size, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;
}

export interface StreamDiagnostics {
  readonly readyState: ConnectionReadyState;
  readonly displayMode: DisplayMode;
  readonly connections: number;
  readonly timeToFirstEventMs: number | null;
  readonly report: TimingReport;
  readonly log: readonly LogEntry[];
  readonly formatClock: (atMs: number) => string;
  readonly mark: () => void;
  readonly clear: () => void;
  readonly reconnect: () => void;
  readonly copyLog: () => void;
  readonly shareLog: () => void;
}

export function useStreamDiagnostics(settings: StreamDiagnosticsSettings): StreamDiagnostics {
  const expectedIntervalMs = settings.tickSeconds * 1000;
  const [state, dispatch] = useReducer((current: State, action: Action): State => {
    switch (action.type) {
      case "lifecycle":
        return reduceLifecycle(current, action.atMs, action.event);
      case "message":
        return reduceMessage(current, action.atMs, action.message, expectedIntervalMs);
      case "mark":
        return append(
          { ...current, markers: current.markers + 1 },
          action.atMs,
          "marker",
          `=== MARCA ${String(current.markers + 1)} ===`,
        );
      case "note":
        return append(current, action.atMs, "neutral", action.text);
      case "clear":
        return {
          ...initialState,
          readyState: current.readyState,
          connections: current.connections,
        };
    }
  }, initialState);

  const connection = useRef<ResilientEventSource | null>(null);
  const [displayMode] = useState(detectDisplayMode);

  useEffect(() => {
    const opened = openStreamDiagnostics(settings, {
      onLifecycle: (event) => {
        dispatch({ type: "lifecycle", atMs: Date.now(), event });
      },
      onMessage: (message) => {
        dispatch({ type: "message", atMs: Date.now(), message });
      },
    });
    connection.current = opened;
    return () => {
      opened.close();
      connection.current = null;
    };
  }, [settings]);

  const report = useMemo(() => reportTiming(state.summary), [state.summary]);

  const exportText = useCallback((): string => {
    const header = [
      `BrazCar SSE diagnostics — ${new Date().toISOString()}`,
      `userAgent: ${navigator.userAgent}`,
      `displayMode: ${displayMode}`,
      `settings: ${JSON.stringify({ ...settings, token: "***" })}`,
      `report: ${JSON.stringify(report)}`,
      `connections: ${String(state.connections)}; timeToFirstEventMs: ${String(state.timeToFirstEventMs)}`,
      "---",
    ];
    return [...header, ...state.log.map((e) => `${formatClock(e.atMs)} ${e.text}`)].join("\n");
  }, [displayMode, report, settings, state.connections, state.log, state.timeToFirstEventMs]);

  const announce = useCallback((result: TextExportResult) => {
    const text = {
      copied: "log copiado",
      shared: "log compartilhado",
      failed: "falha ao exportar",
    };
    dispatch({ type: "note", atMs: Date.now(), text: text[result] });
  }, []);

  return {
    readyState: state.readyState,
    displayMode,
    connections: state.connections,
    timeToFirstEventMs: state.timeToFirstEventMs,
    report,
    log: state.log,
    formatClock,
    mark: () => {
      dispatch({ type: "mark", atMs: Date.now() });
    },
    clear: () => {
      dispatch({ type: "clear" });
    },
    reconnect: () => connection.current?.reconnect(),
    copyLog: () => void copyText(exportText()).then(announce),
    shareLog: () => void shareText("BrazCar SSE diagnostics", exportText()).then(announce),
  };
}
