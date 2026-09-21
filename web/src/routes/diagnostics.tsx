import { createFileRoute } from "@tanstack/react-router";

import type { HeartbeatKind, StreamDiagnosticsSettings } from "@/shared/domain/stream-diagnostics";
import { StreamDiagnosticsView } from "@/shared/ui/stream-diagnostics-view";

/**
 * DIAGNOSTIC page of the SSE tunnel risk test (D-049), removable with the backend route.
 * /diagnostics?token=…&tickSeconds=1&heartbeatSeconds=15&heartbeatKind=comment&silenceLimitMs=45000
 * &resumeGraceMs=3000 — only the token is required; the router writes the defaults back into the URL.
 */

const numberOr = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  return value === undefined || value === "" || Number.isNaN(parsed) ? fallback : parsed;
};

export const Route = createFileRoute("/diagnostics")({
  validateSearch: (search: Record<string, unknown>): StreamDiagnosticsSettings => ({
    // The router parses search values as JSON, so an all-digit token arrives as a number.
    token:
      typeof search.token === "string" || typeof search.token === "number"
        ? String(search.token)
        : "",
    tickSeconds: numberOr(search.tickSeconds, 1),
    heartbeatSeconds: numberOr(search.heartbeatSeconds, 15),
    heartbeatKind: (search.heartbeatKind === "event" ? "event" : "comment") satisfies HeartbeatKind,
    silenceLimitMs: numberOr(search.silenceLimitMs, 45_000),
    resumeGraceMs: numberOr(search.resumeGraceMs, 3000),
  }),
  component: DiagnosticsPage,
});

function DiagnosticsPage() {
  // The router shares the search object structurally: same values, same identity, no reconnect.
  return <StreamDiagnosticsView settings={Route.useSearch()} />;
}
