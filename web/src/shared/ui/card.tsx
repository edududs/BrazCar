import type { ReactNode } from "react";

interface CardProps {
  readonly children: ReactNode;
  /** A card that is a link to something is rendered by the caller's `Link`; this only frames it. */
  readonly muted?: boolean;
}

/** A bordered surface for one item of a list or one block of a page. */
export function Card({ children, muted = false }: CardProps) {
  return (
    <section
      className={`flex flex-col gap-2 rounded-xl border border-neutral-soft bg-surface p-4 ${muted ? "opacity-60" : ""}`}
    >
      {children}
    </section>
  );
}
