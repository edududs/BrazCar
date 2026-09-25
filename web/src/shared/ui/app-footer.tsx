import type { ReactNode } from "react";

interface AppFooterProps {
  /** The build's version, and whatever support needs next to it. */
  readonly children: ReactNode;
}

/** The build's version at the bottom of every page, for support (D-105). */
export function AppFooter({ children }: AppFooterProps) {
  return (
    <footer className="mx-auto w-full max-w-md px-gutter pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-center text-caption text-ink-3">
      {children}
    </footer>
  );
}
