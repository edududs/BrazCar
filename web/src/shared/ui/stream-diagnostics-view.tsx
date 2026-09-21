import { useStreamDiagnostics } from "../app/use-stream-diagnostics";
import type { StreamDiagnosticsSettings } from "../domain/stream-diagnostics";
import { ActionButton } from "./action-button";
import { EventLog } from "./event-log";
import { PageShell } from "./page-shell";
import { type Stat, StatGrid, type StatTone } from "./stat-grid";

/** DIAGNOSTIC, removable with the backend route `/api/diagnostics/sse` (D-049). */

const ms = (value: number | null) => (value === null ? "—" : `${String(Math.round(value))}ms`);
const alarm = (count: number): StatTone => (count > 0 ? "critical" : "positive");

interface StreamDiagnosticsViewProps {
  readonly settings: StreamDiagnosticsSettings;
}

export function StreamDiagnosticsView({ settings }: StreamDiagnosticsViewProps) {
  const diagnostics = useStreamDiagnostics(settings);
  const { report } = diagnostics;

  const stats: readonly Stat[] = [
    {
      label: "readyState",
      value: diagnostics.readyState,
      tone: diagnostics.readyState === "open" ? "positive" : "critical",
    },
    { label: "modo", value: diagnostics.displayMode },
    { label: "conexões", value: String(diagnostics.connections) },
    { label: "1º evento", value: ms(diagnostics.timeToFirstEventMs) },
    { label: "eventos", value: String(report.count) },
    { label: "perdidos", value: String(report.missing), tone: alarm(report.missing) },
    { label: "atraso méd / máx", value: `${ms(report.delayAvgMs)} / ${ms(report.delayMaxMs)}` },
    { label: "jitter méd / máx", value: `${ms(report.jitterAvgMs)} / ${ms(report.jitterMaxMs)}` },
    {
      label: "intervalo mín / méd / máx",
      value: `${ms(report.intervalMinMs)} / ${ms(report.intervalAvgMs)} / ${ms(report.intervalMaxMs)}`,
    },
    { label: "rajadas", value: String(report.bursts), tone: alarm(report.bursts) },
    { label: "travadas", value: String(report.stalls), tone: alarm(report.stalls) },
  ];

  return (
    <PageShell title="Diagnóstico SSE">
      <StatGrid stats={stats} />
      <div className="flex flex-wrap gap-2">
        <ActionButton emphasis="primary" onPress={diagnostics.mark}>
          Marcar momento
        </ActionButton>
        <ActionButton onPress={diagnostics.shareLog}>Compartilhar log</ActionButton>
        <ActionButton onPress={diagnostics.copyLog}>Copiar log</ActionButton>
        <ActionButton onPress={diagnostics.reconnect}>Reconectar</ActionButton>
        <ActionButton onPress={diagnostics.clear}>Limpar</ActionButton>
      </div>
      <EventLog entries={diagnostics.log} formatClock={diagnostics.formatClock} />
    </PageShell>
  );
}
