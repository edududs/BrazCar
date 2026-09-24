import type { ReactNode } from "react";

interface NoticeBarProps {
  readonly children: ReactNode;
  /** Buttons at the end of the bar, when the notice offers one. */
  readonly actions?: ReactNode;
}

/** A quiet line under the navigation: a new build, a hint, a "done" after leaving a screen. */
export function NoticeBar({ children, actions }: NoticeBarProps) {
  return (
    <aside className="border-b border-neutral-soft bg-accent-soft">
      <div className="mx-auto flex max-w-md flex-wrap items-center justify-between gap-2 px-6 py-2 text-sm">
        <p role="status">{children}</p>
        {actions === undefined ? null : <div className="flex gap-2">{actions}</div>}
      </div>
    </aside>
  );
}
