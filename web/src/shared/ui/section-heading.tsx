import type { ReactNode } from "react";

interface SectionHeadingProps {
  readonly children: ReactNode;
  /** What sits at the other end of the line: a count, a note. */
  readonly aside?: ReactNode;
}

/** A small heading over a group of the list: "Hoje · quinta, 24", with the count at the end. */
export function SectionHeading({ children, aside }: SectionHeadingProps) {
  return (
    <div className="mt-1.5 flex items-center justify-between gap-3">
      <h2 className="text-caption font-bold tracking-[0.08em] text-ink-3 uppercase">{children}</h2>
      {aside === undefined ? null : <span className="text-caption text-ink-3">{aside}</span>}
    </div>
  );
}
