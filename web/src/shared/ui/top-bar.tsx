import type { ReactNode } from "react";

import { BrandMark, Wordmark } from "./brand-mark";

interface TopBarProps {
  /** What the compact bar says once the wordmark has scrolled away. */
  readonly compactTitle: string;
  /** Icon buttons at the right end. */
  readonly actions?: ReactNode;
}

/**
 * The top of the board: the wordmark, which shrinks away as the page scrolls, and a compact glass
 * bar that takes its place. Both are driven by the scroll position in CSS alone (F5): where the
 * browser has no scroll-driven animations, or the person asked for less motion, the wordmark
 * simply stays and the compact bar never shows.
 */
export function TopBar({ compactTitle, actions }: TopBarProps) {
  return (
    <>
      <div
        aria-hidden
        className="shell-compact pointer-events-none fixed inset-x-0 top-0 z-10 flex items-center justify-center gap-2 border-b border-line bg-glass pt-[env(safe-area-inset-top)] pb-2.5 font-display text-body font-bold backdrop-blur-[22px]"
      >
        <span className="mt-2.5 flex items-center gap-2">
          <BrandMark />
          {compactTitle}
        </span>
      </div>
      <header className="flex min-h-11 items-center justify-between gap-3">
        <div className="shell-title">
          <Wordmark />
        </div>
        {actions === undefined ? null : <div className="flex items-center gap-2">{actions}</div>}
      </header>
    </>
  );
}
