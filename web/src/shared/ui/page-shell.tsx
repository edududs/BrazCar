import type { ReactNode } from "react";

interface PageShellProps {
  readonly title: string;
  /** Links or buttons that sit beside the title: the page's ways out. */
  readonly actions?: ReactNode;
  readonly children: ReactNode;
}

export function PageShell({ title, actions, children }: PageShellProps) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 bg-surface p-6 text-content">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{title}</h1>
        {actions === undefined ? null : <nav className="flex gap-3 text-sm">{actions}</nav>}
      </header>
      {children}
    </main>
  );
}
