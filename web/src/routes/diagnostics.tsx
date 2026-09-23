import { type SearchSchemaInput, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import type { HeartbeatKind, StreamDiagnosticsSettings } from "@/shared/domain/stream-diagnostics";
import { ActionButton } from "@/shared/ui/action-button";
import { Form } from "@/shared/ui/form";
import { PageShell } from "@/shared/ui/page-shell";
import { StreamDiagnosticsView } from "@/shared/ui/stream-diagnostics-view";
import { TextField } from "@/shared/ui/text-field";

/**
 * DIAGNOSTIC page of the SSE tunnel risk test (D-049), removable with the backend route.
 * /diagnostics?token=…&tickSeconds=1&heartbeatSeconds=15&heartbeatKind=event&silenceLimitMs=35000
 * &resumeGraceMs=3000 — only the token is required; the router writes the defaults back into the URL.
 * Kept on purpose, reachable only by typing the address (D-107); without a token it asks for one.
 */

const numberOr = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  return value === undefined || value === "" || Number.isNaN(parsed) ? fallback : parsed;
};

export const Route = createFileRoute("/diagnostics")({
  validateSearch: (
    search: Record<string, unknown> & SearchSchemaInput,
  ): StreamDiagnosticsSettings => ({
    // The router parses search values as JSON, so an all-digit token arrives as a number.
    token:
      typeof search.token === "string" || typeof search.token === "number"
        ? String(search.token)
        : "",
    tickSeconds: numberOr(search.tickSeconds, 1),
    heartbeatSeconds: numberOr(search.heartbeatSeconds, 15),
    // The production signal beats with an event (D-077); `comment` stays for comparison.
    heartbeatKind: (search.heartbeatKind === "comment"
      ? "comment"
      : "event") satisfies HeartbeatKind,
    silenceLimitMs: numberOr(search.silenceLimitMs, 35_000),
    resumeGraceMs: numberOr(search.resumeGraceMs, 3000),
  }),
  component: DiagnosticsPage,
});

function DiagnosticsPage() {
  // The router shares the search object structurally: same values, same identity, no reconnect.
  const settings = Route.useSearch();
  return settings.token === "" ? <TokenForm /> : <StreamDiagnosticsView settings={settings} />;
}

function TokenForm() {
  const navigate = useNavigate({ from: Route.fullPath });
  const [token, setToken] = useState("");
  return (
    <PageShell title="Diagnóstico SSE">
      <Form
        onSubmit={() => {
          void navigate({ search: (previous) => ({ ...previous, token: token.trim() }) });
        }}
      >
        <TextField label="Token" value={token} onChange={setToken} autoComplete="off" required />
        <ActionButton submit emphasis="primary">
          Abrir
        </ActionButton>
      </Form>
    </PageShell>
  );
}
