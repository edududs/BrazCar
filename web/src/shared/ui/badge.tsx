import type { ReactNode } from "react";

export type BadgeTone = "neutral" | "positive" | "critical" | "accent";

interface BadgeProps {
  readonly tone?: BadgeTone;
  readonly children: ReactNode;
}

const tones = {
  neutral: "bg-neutral-soft text-content",
  positive: "bg-positive-soft text-positive",
  critical: "bg-critical-soft text-critical",
  accent: "bg-accent-soft text-accent",
} as const satisfies Record<BadgeTone, string>;

/** A short label with a tone: a status, a count, a note. */
export function Badge({ tone = "neutral", children }: BadgeProps) {
  return (
    <span className={`w-fit rounded-full px-3 py-1 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}
