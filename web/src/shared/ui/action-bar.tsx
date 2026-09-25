import type { ReactNode } from "react";

interface ActionBarProps {
  readonly children: ReactNode;
  /** One line under the action that says what it does. */
  readonly hint?: ReactNode;
}

/** The page's one action, fixed under the thumb on glass, clear of the home indicator (S03). */
export function ActionBar({ children, hint }: ActionBarProps) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-glass backdrop-blur-[22px] backdrop-saturate-[1.6]">
      <div className="mx-auto flex max-w-md flex-col gap-2.5 px-gutter pt-3.5 pb-[calc(env(safe-area-inset-bottom)+0.875rem)]">
        {children}
        {hint === undefined ? null : <p className="text-center text-caption text-ink-3">{hint}</p>}
      </div>
    </div>
  );
}
