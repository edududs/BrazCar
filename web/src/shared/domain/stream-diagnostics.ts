/** Contracts of the SSE diagnostics page (risk test of D-049). Types only. */

export type HeartbeatKind = "comment" | "event";

export interface StreamDiagnosticsSettings {
  readonly token: string;
  /** Seconds between numbered events. 0 turns them off. */
  readonly tickSeconds: number;
  /** Seconds between heartbeats. 0 turns them off. */
  readonly heartbeatSeconds: number;
  readonly heartbeatKind: HeartbeatKind;
  readonly silenceLimitMs: number;
  readonly resumeGraceMs: number;
}

/** One numbered event, as received. */
export interface Reception {
  /** Which connection delivered it; the server restarts `seq` on every connection. */
  readonly connection: number;
  readonly seq: number;
  readonly serverTimeMs: number;
  readonly receivedAtMs: number;
}

export type LogTone = "neutral" | "positive" | "critical" | "marker";

export interface LogEntry {
  readonly id: number;
  readonly atMs: number;
  readonly tone: LogTone;
  readonly text: string;
}
