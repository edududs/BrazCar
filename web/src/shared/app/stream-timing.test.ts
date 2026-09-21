import { describe, expect, it } from "vitest";

import type { Reception } from "../domain/stream-diagnostics";
import { addReception, emptyTimingSummary, reportTiming } from "./stream-timing";

const EXPECTED_MS = 1000;

function summarize(receptions: readonly Reception[]) {
  return reportTiming(
    receptions.reduce(
      (summary, reception) => addReception(summary, reception, EXPECTED_MS),
      emptyTimingSummary,
    ),
  );
}

/** Server emits `seq` at `seq` seconds; `receivedAtMs` is when the client saw it. */
function reception(seq: number, receivedAtMs: number, connection = 1): Reception {
  return { connection, seq, serverTimeMs: seq * 1000, receivedAtMs };
}

describe("stream timing", () => {
  it("reports nothing measurable for an empty stream", () => {
    expect(summarize([])).toMatchObject({ count: 0, delayAvgMs: null, intervalAvgMs: null });
  });

  it("sees a steady stream as steady", () => {
    const report = summarize([reception(1, 1050), reception(2, 2050), reception(3, 3050)]);

    expect(report).toMatchObject({
      count: 3,
      delayAvgMs: 50,
      delayMaxMs: 50,
      jitterMaxMs: 0,
      intervalAvgMs: 1000,
      bursts: 0,
      stalls: 0,
      missing: 0,
    });
  });

  it("flags a buffering proxy: one stall, then events released together", () => {
    const report = summarize([
      reception(1, 1050),
      reception(2, 5000),
      reception(3, 5004),
      reception(4, 5008),
      reception(5, 5050),
    ]);

    expect(report).toMatchObject({ stalls: 1, bursts: 3, intervalMinMs: 4, intervalMaxMs: 3950 });
    expect(report.jitterMaxMs).toBe(2950);
  });

  it("removes clock skew from jitter but not from delay", () => {
    const skewed = summarize([reception(1, 61_000), reception(2, 62_200)]);

    expect(skewed.delayMaxMs).toBe(60_200);
    expect(skewed.jitterMaxMs).toBe(200);
  });

  it("counts skipped numbers inside a connection and ignores the restart across connections", () => {
    const report = summarize([reception(1, 1000), reception(4, 4000), reception(1, 9000, 2)]);

    expect(report.missing).toBe(2);
    expect(report.stalls).toBe(1);
  });
});
