export type StatTone = "neutral" | "positive" | "critical";

export interface Stat {
  readonly label: string;
  readonly value: string;
  readonly tone?: StatTone;
}

const valueTone = {
  neutral: "text-ink",
  positive: "text-positive",
  critical: "text-critical",
} as const;

interface StatGridProps {
  readonly stats: readonly Stat[];
}

export function StatGrid({ stats }: StatGridProps) {
  return (
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {stats.map(({ label, value, tone = "neutral" }) => (
        <div key={label} className="rounded-field bg-surface-2 px-3 py-2">
          <dt className="text-caption text-ink-3">{label}</dt>
          <dd className={`font-mono text-sm font-semibold ${valueTone[tone]}`}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
