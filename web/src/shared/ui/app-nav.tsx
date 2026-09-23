import type { ReactNode } from "react";

interface AppNavProps {
  /** The home link, left. */
  readonly brand: ReactNode;
  /** The other destinations, right. */
  readonly children: ReactNode;
}

/** The bar on top of every page: the way to anywhere else, from anywhere. */
export function AppNav({ brand, children }: AppNavProps) {
  return (
    // Under a notch or the status bar the insets are non-zero (viewport-fit=cover); elsewhere zero.
    <header className="border-b border-neutral-soft bg-surface pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)]">
      <nav className="mx-auto flex max-w-md items-center justify-between gap-3 px-6 py-3 text-sm">
        <span className="text-base font-semibold">{brand}</span>
        <span className="flex items-center gap-4">{children}</span>
      </nav>
    </header>
  );
}

/** Class of a link inside `AppNav`; the current page is marked by TanStack Router's `data-status`. */
export const navLinkClass =
  "flex min-h-11 items-center underline-offset-4 data-[status=active]:font-semibold data-[status=active]:underline";
