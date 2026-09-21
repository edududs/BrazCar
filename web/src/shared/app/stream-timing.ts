import type { Reception } from "../domain/stream-diagnostics";

/**
 * Running statistics of a numbered stream. Pure: `addReception` returns a new summary.
 *
 * `delay` is the client clock minus the server clock, so it carries the skew between the two machines.
 * `jitter` removes it by subtracting the smallest delay seen: what is left is how late an event was
 * compared with the luckiest one.
 */
export interface TimingSummary {
  readonly count: number;
  readonly delaySumMs: number;
  readonly delayMinMs: number;
  readonly delayMaxMs: number;
  readonly intervalCount: number;
  readonly intervalSumMs: number;
  readonly intervalMinMs: number;
  readonly intervalMaxMs: number;
  /** Intervals far shorter than expected: events that a proxy held and released together. */
  readonly bursts: number;
  /** Intervals far longer than expected. */
  readonly stalls: number;
  /** Sequence numbers skipped inside one connection. */
  readonly missing: number;
  readonly last: Reception | null;
}

export const emptyTimingSummary: TimingSummary = {
  count: 0,
  delaySumMs: 0,
  delayMinMs: Number.POSITIVE_INFINITY,
  delayMaxMs: Number.NEGATIVE_INFINITY,
  intervalCount: 0,
  intervalSumMs: 0,
  intervalMinMs: Number.POSITIVE_INFINITY,
  intervalMaxMs: Number.NEGATIVE_INFINITY,
  bursts: 0,
  stalls: 0,
  missing: 0,
  last: null,
};

const BURST_FACTOR = 0.25;
const STALL_FACTOR = 2.5;

export function addReception(
  summary: TimingSummary,
  reception: Reception,
  expectedIntervalMs: number,
): TimingSummary {
  const delay = reception.receivedAtMs - reception.serverTimeMs;
  const previous = summary.last;
  const sameConnection = previous !== null && previous.connection === reception.connection;
  const interval = sameConnection ? reception.receivedAtMs - previous.receivedAtMs : null;
  const skipped = sameConnection ? Math.max(0, reception.seq - previous.seq - 1) : 0;

  return {
    count: summary.count + 1,
    delaySumMs: summary.delaySumMs + delay,
    delayMinMs: Math.min(summary.delayMinMs, delay),
    delayMaxMs: Math.max(summary.delayMaxMs, delay),
    intervalCount: summary.intervalCount + (interval === null ? 0 : 1),
    intervalSumMs: summary.intervalSumMs + (interval ?? 0),
    intervalMinMs:
      interval === null ? summary.intervalMinMs : Math.min(summary.intervalMinMs, interval),
    intervalMaxMs:
      interval === null ? summary.intervalMaxMs : Math.max(summary.intervalMaxMs, interval),
    bursts:
      summary.bursts + (interval !== null && interval < expectedIntervalMs * BURST_FACTOR ? 1 : 0),
    stalls:
      summary.stalls + (interval !== null && interval > expectedIntervalMs * STALL_FACTOR ? 1 : 0),
    missing: summary.missing + skipped,
    last: reception,
  };
}

export interface TimingReport {
  readonly count: number;
  readonly delayAvgMs: number | null;
  readonly delayMaxMs: number | null;
  readonly jitterAvgMs: number | null;
  readonly jitterMaxMs: number | null;
  readonly intervalAvgMs: number | null;
  readonly intervalMinMs: number | null;
  readonly intervalMaxMs: number | null;
  readonly bursts: number;
  readonly stalls: number;
  readonly missing: number;
}

export function reportTiming(summary: TimingSummary): TimingReport {
  const hasDelays = summary.count > 0;
  const hasIntervals = summary.intervalCount > 0;
  const delayAvg = hasDelays ? summary.delaySumMs / summary.count : null;
  return {
    count: summary.count,
    delayAvgMs: delayAvg,
    delayMaxMs: hasDelays ? summary.delayMaxMs : null,
    jitterAvgMs: delayAvg === null ? null : delayAvg - summary.delayMinMs,
    jitterMaxMs: hasDelays ? summary.delayMaxMs - summary.delayMinMs : null,
    intervalAvgMs: hasIntervals ? summary.intervalSumMs / summary.intervalCount : null,
    intervalMinMs: hasIntervals ? summary.intervalMinMs : null,
    intervalMaxMs: hasIntervals ? summary.intervalMaxMs : null,
    bursts: summary.bursts,
    stalls: summary.stalls,
    missing: summary.missing,
  };
}
