import type { ReactNode } from "react";

import { TopBar } from "./top-bar";

interface PageShellProps {
  readonly title: string;
  /**
   * `title` puts the title on the page in display type; `brand` puts the wordmark there instead
   * and keeps the title for assistive technology only, as the board does (F6).
   */
  readonly heading?: "title" | "brand";
  /** Links or buttons that sit beside the title: the page's ways out. */
  readonly actions?: ReactNode;
  readonly children: ReactNode;
}

export function PageShell({ title, heading = "title", actions, children }: PageShellProps) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-gutter py-5">
      {heading === "brand" ? (
        <>
          <h1 className="sr-only">{title}</h1>
          <TopBar compactTitle={title} actions={actions} />
        </>
      ) : (
        <header className="flex min-h-11 flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-title font-bold text-balance">{title}</h1>
          {actions === undefined ? null : (
            <nav className="flex gap-3 text-secondary font-semibold text-brand-ink">{actions}</nav>
          )}
        </header>
      )}
      {children}
    </main>
  );
}
