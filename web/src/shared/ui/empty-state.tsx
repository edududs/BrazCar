import type { ReactNode } from "react";

interface EmptyStateProps {
  readonly title: string;
  /** The heading level the page needs: `h1` when the state is the whole page. */
  readonly as?: "h1" | "h2";
  readonly children?: ReactNode;
  /** The one thing to do about it, if any. */
  readonly action?: ReactNode;
}

/** Nothing here, said with the route drawing: two stops and a dashed line between them. */
export function EmptyState({ title, as: Heading = "h2", children, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3.5 px-3 pt-9 pb-3 text-center">
      <RouteGlyph />
      <Heading className="font-display text-[24px] leading-[1.12] font-bold tracking-[-0.025em] text-balance">
        {title}
      </Heading>
      {children === undefined ? null : (
        <p className="text-body text-ink-2 text-pretty">{children}</p>
      )}
      {action === undefined ? null : <div className="mt-1">{action}</div>}
    </div>
  );
}

/** The empty route: a stop in ink, a dashed line, a stop in brand. */
function RouteGlyph() {
  return (
    <svg width="148" height="16" viewBox="0 0 148 16" aria-hidden className="mb-1.5 shrink-0">
      <circle
        cx="8"
        cy="8"
        r="5.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        className="text-ink-3"
      />
      <line
        x1="20"
        y1="8"
        x2="128"
        y2="8"
        stroke="currentColor"
        strokeWidth="3"
        strokeDasharray="6 6"
        className="text-line-strong"
      />
      <circle
        cx="140"
        cy="8"
        r="5.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        className="text-brand"
      />
    </svg>
  );
}
