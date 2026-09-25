import type { ReactNode } from "react";

interface ActionBarProps {
  readonly children: ReactNode;
  /** One line under the action that says what it does. */
  readonly hint?: ReactNode;
  /** Inside a padded page (a `PageShell`): reach its edges and its bottom. */
  readonly bleed?: boolean;
}

/**
 * The page's one action, under the thumb on glass, clear of the home indicator (S03).
 *
 * Sticky at the end of the page, never fixed: it takes its own room in the flow, so the last
 * field of a long form always scrolls above it and no page has to remember to leave space. In a
 * short page it sits at the bottom of the screen all the same (`mt-auto` in a full-height column).
 */
export function ActionBar({ children, hint, bleed = false }: ActionBarProps) {
  return (
    <div
      className={`sticky bottom-0 z-20 mt-auto border-t border-line bg-glass backdrop-blur-[22px] backdrop-saturate-[1.6] ${bleed ? "-mx-gutter -mb-5" : ""}`}
    >
      <div className="mx-auto flex max-w-md flex-col gap-2.5 px-gutter pt-3.5 pb-[calc(env(safe-area-inset-bottom)+0.875rem)]">
        {children}
        {hint === undefined ? null : <p className="text-center text-caption text-ink-3">{hint}</p>}
      </div>
    </div>
  );
}
