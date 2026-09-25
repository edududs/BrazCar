import type { ReactNode } from "react";

export type BadgeTone =
  | "neutral"
  | "positive"
  | "critical"
  | "accent"
  /** Ink on the page colour: the one state that must read from afar, "Lotada". */
  | "inverse"
  /** Just a line: where the ride came from, "via WhatsApp". */
  | "outline"
  /** Dawn: only ever about time, "Agora". */
  | "sun";

interface BadgeProps {
  readonly tone?: BadgeTone;
  readonly icon?: ReactNode;
  readonly children: ReactNode;
}

const tones = {
  neutral: "bg-surface-2 text-ink-2",
  positive: "bg-positive-soft text-positive",
  critical: "bg-critical-soft text-critical",
  accent: "bg-brand-soft text-brand-ink",
  inverse: "bg-ink text-bg",
  outline: "bg-transparent text-ink-2 inset-ring-[1.5px] inset-ring-line-strong",
  sun: "bg-sun-soft text-sun-ink",
} as const satisfies Record<BadgeTone, string>;

/** A short label with a tone: a status, a count, a note. */
export function Badge({ tone = "neutral", icon, children }: BadgeProps) {
  return (
    <span
      className={`inline-flex h-[26px] w-fit shrink-0 items-center gap-1 rounded-full px-2.5 text-caption font-bold whitespace-nowrap ${tones[tone]}`}
    >
      {icon}
      {children}
    </span>
  );
}
