import type { ReactNode } from "react";

interface NoticeScreenProps {
  readonly title: string;
  readonly children: ReactNode;
  /** The one thing to do about it, if any. */
  readonly action?: ReactNode;
  /** A glyph above the title: an icon on a tile, or a drawing. */
  readonly glyph?: ReactNode;
}

/** A whole screen that says one thing: no network, update required, nothing here. */
export function NoticeScreen({ title, children, action, glyph }: NoticeScreenProps) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center gap-3.5 px-gutter pt-16 pb-6 text-center">
      {glyph === undefined ? null : (
        <span className="mb-1.5 grid size-[76px] place-items-center rounded-dialog bg-surface-2 text-ink-2">
          {glyph}
        </span>
      )}
      <h1 className="font-display text-heading font-bold text-balance">{title}</h1>
      <p className="text-secondary text-ink-2 text-pretty">{children}</p>
      {action === undefined ? null : <div className="mt-2 w-full max-w-xs">{action}</div>}
    </main>
  );
}
