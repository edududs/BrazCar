import { Link, type LinkProps } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { Icon, type IconName } from "./icon";

export interface Tab {
  readonly to: NonNullable<LinkProps["to"]>;
  readonly label: string;
  readonly icon: IconName;
  /** The one tab that is an action more than a place: drawn as a brand button. */
  readonly primary?: boolean;
}

interface TabBarProps {
  readonly tabs: readonly Tab[];
}

/**
 * The way to anywhere, under the thumb: four destinations today, with room for a fifth. Glass over
 * the content, clear of the home indicator. The current page is marked by TanStack Router's
 * `data-status`, so the bar itself keeps no state.
 */
export function TabBar({ tabs }: TabBarProps) {
  return (
    <nav
      aria-label="Principal"
      className="sticky bottom-0 z-20 grid auto-cols-fr grid-flow-col border-t border-line bg-glass px-2.5 pt-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] backdrop-blur-[22px] backdrop-saturate-[1.6]"
    >
      {tabs.map((tab) => (
        <TabLink key={tab.label} tab={tab} />
      ))}
    </nav>
  );
}

function TabLink({ tab }: { readonly tab: Tab }): ReactNode {
  return (
    <Link
      to={tab.to}
      className="group flex min-h-[50px] flex-col items-center justify-center gap-1 text-[11px] font-semibold tracking-[0.01em] text-ink-3 data-[status=active]:text-ink"
    >
      {tab.primary ? (
        <span className="grid h-[30px] w-[46px] place-items-center rounded-[11px] bg-brand text-on-brand">
          <Icon name={tab.icon} />
        </span>
      ) : (
        <span className="group-data-[status=active]:text-brand">
          <Icon name={tab.icon} size={24} />
        </span>
      )}
      {tab.label}
    </Link>
  );
}
