import type { ReactNode } from "react";

interface PageShellProps {
  readonly title: string;
  /** Links or buttons that sit beside the title: the page's ways out. */
  readonly actions?: ReactNode;
  readonly children: ReactNode;
}

export function PageShell({ title, actions, children }: PageShellProps) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-gutter py-5">
      <header className="flex min-h-11 flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-title font-bold text-balance">{title}</h1>
        {actions === undefined ? null : (
          <nav className="flex gap-3 text-secondary font-semibold text-brand-ink">{actions}</nav>
        )}
      </header>
      {children}
    </main>
  );
}
