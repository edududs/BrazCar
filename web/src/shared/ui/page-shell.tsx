import type { ReactNode } from "react";

interface PageShellProps {
  readonly title: string;
  readonly children: ReactNode;
}

export function PageShell({ title, children }: PageShellProps) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 bg-surface p-6 text-content">
      <h1 className="text-2xl font-semibold">{title}</h1>
      {children}
    </main>
  );
}
