import type { LogEntry, LogTone } from "../domain/stream-diagnostics";

const entryTone = {
  neutral: "",
  positive: "text-positive",
  critical: "text-critical",
  marker: "bg-accent-soft text-accent font-semibold",
} as const satisfies Record<LogTone, string>;

interface EventLogProps {
  /** Chronological; the newest is shown first. */
  readonly entries: readonly LogEntry[];
  readonly formatClock: (atMs: number) => string;
  /** How many of the newest entries to render. The full log lives in the export. */
  readonly visible?: number;
}

export function EventLog({ entries, formatClock, visible = 200 }: EventLogProps) {
  return (
    <ol
      aria-label="Registro de eventos"
      className="flex-1 overflow-y-auto rounded-lg border border-neutral-soft font-mono text-xs"
    >
      {entries
        .slice(-visible)
        .reverse()
        .map((entry) => (
          <li key={entry.id} className={`flex gap-2 px-2 py-0.5 ${entryTone[entry.tone]}`}>
            <time className="shrink-0 opacity-60">{formatClock(entry.atMs)}</time>
            <span className="break-all">{entry.text}</span>
          </li>
        ))}
    </ol>
  );
}
