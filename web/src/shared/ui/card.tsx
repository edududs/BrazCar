import type { ReactNode } from "react";

interface CardProps {
  readonly children: ReactNode;
  /** A card that is a link to something is rendered by the caller's `Link`; this only frames it. */
  /** Past or cancelled: the text fades, the surface stays, so the list keeps its rhythm. */
  readonly muted?: boolean;
  /** Just changed, just found: a brand ring around it. */
  readonly highlight?: boolean;
  /** Tight when the rows inside draw their own spacing, like a route. */
  readonly padding?: "default" | "tight";
}

/** A surface for one item of a list or one block of a page. */
export function Card({
  children,
  muted = false,
  highlight = false,
  padding = "default",
}: CardProps) {
  return (
    <section
      className={`flex flex-col gap-2.5 rounded-card border border-line-soft bg-surface shadow-1 ${padding === "tight" ? "px-4 py-1.5" : "p-4"} ${muted ? "text-ink-3" : "text-ink"} ${highlight ? "ring-2 ring-brand" : ""}`}
    >
      {children}
    </section>
  );
}
