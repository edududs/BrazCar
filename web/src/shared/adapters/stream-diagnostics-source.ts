import type { ConnectionLifecycleEvent } from "../domain/signal-connection";
import type { StreamDiagnosticsSettings } from "../domain/stream-diagnostics";
import { apiBaseUrl } from "./api/base-url";
import { type ResilientEventSource, openResilientEventSource } from "./resilient-event-source";

/** DIAGNOSTIC, removable with the backend route `/api/diagnostics/sse` (D-049). */

export type DiagnosticMessage =
  | { readonly kind: "tick"; readonly seq: number; readonly serverTimeMs: number }
  | { readonly kind: "heartbeat"; readonly serverTimeMs: number };

interface Handlers {
  readonly onMessage: (message: DiagnosticMessage) => void;
  readonly onLifecycle: (event: ConnectionLifecycleEvent) => void;
}

function numberField(payload: unknown, field: string): number {
  if (typeof payload === "object" && payload !== null && field in payload) {
    const value = (payload as Record<string, unknown>)[field];
    if (typeof value === "number") return value;
  }
  throw new Error(`diagnostic payload is missing the number "${field}"`);
}

export function openStreamDiagnostics(
  settings: StreamDiagnosticsSettings,
  handlers: Handlers,
): ResilientEventSource {
  const query = new URLSearchParams({
    token: settings.token,
    tick_seconds: String(settings.tickSeconds),
    heartbeat_seconds: String(settings.heartbeatSeconds),
    heartbeat_kind: settings.heartbeatKind,
  });
  return openResilientEventSource({
    url: `${apiBaseUrl}/api/diagnostics/sse?${query.toString()}`,
    // Nothing needs the cookie yet; it is on so the test covers the real adapter's CORS path (D-059).
    withCredentials: true,
    events: ["tick", "ping"],
    silenceLimitMs: settings.silenceLimitMs,
    resumeGraceMs: settings.resumeGraceMs,
    onLifecycle: handlers.onLifecycle,
    onMessage: ({ event, data }) => {
      const payload: unknown = JSON.parse(data);
      const serverTimeMs = numberField(payload, "server_time_ms");
      handlers.onMessage(
        event === "tick"
          ? { kind: "tick", seq: numberField(payload, "seq"), serverTimeMs }
          : { kind: "heartbeat", serverTimeMs },
      );
    },
  });
}
