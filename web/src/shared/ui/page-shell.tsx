import type { LinkProps } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { IconLink } from "./icon-button";
import type { IconName } from "./icon";
import { TopBar } from "./top-bar";

interface BackLink {
  readonly to: NonNullable<LinkProps["to"]>;
  readonly params?: LinkProps["params"];
  /** `back` for a page under another, `x` for one that opened over everything. */
  readonly icon: Extract<IconName, "back" | "x">;
  readonly label: string;
}

interface PageShellProps {
  readonly title: string;
  /**
   * `title` puts the title on the page in display type; `brand` puts the wordmark there instead
   * and keeps the title for assistive technology only, as the board does (F6); `compact` sets a
   * small centred title beside the way back, as a form does (S07).
   */
  readonly heading?: "title" | "brand" | "compact";
  /** The way back, on its own row above the title, or beside it when compact. */
  readonly back?: BackLink;
  /** Links or buttons that sit beside the title: the page's ways out. */
  readonly actions?: ReactNode;
  /** Something between the way back and the title: the mark, a glyph (S12, S13). */
  readonly lead?: ReactNode;
  /** One line under the title. */
  readonly intro?: string;
  readonly children: ReactNode;
}

export function PageShell({
  title,
  heading = "title",
  back,
  actions,
  lead,
  intro,
  children,
}: PageShellProps) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-gutter py-5">
      {heading === "brand" ? (
        <>
          <h1 className="sr-only">{title}</h1>
          <TopBar compactTitle={title} actions={actions} />
        </>
      ) : heading === "compact" ? (
        <header className="grid min-h-11 grid-cols-[44px_1fr_44px] items-center gap-2">
          {back === undefined ? <span /> : <IconLink {...back} />}
          <h1 className="text-center text-body font-semibold">{title}</h1>
          <span className="justify-self-end">{actions}</span>
        </header>
      ) : (
        <>
          {back === undefined ? null : (
            <div className="flex min-h-11 items-center">
              <IconLink {...back} />
            </div>
          )}
          {lead}
          <header className="flex flex-col gap-2">
            <div className="flex min-h-11 flex-wrap items-center justify-between gap-3">
              <h1 className="font-display text-title font-bold text-balance">{title}</h1>
              {actions === undefined ? null : (
                <nav className="flex gap-3 text-secondary font-semibold text-brand-ink">
                  {actions}
                </nav>
              )}
            </div>
            {intro === undefined ? null : (
              <p className="text-body text-ink-2 text-pretty">{intro}</p>
            )}
          </header>
        </>
      )}
      {children}
    </main>
  );
}
