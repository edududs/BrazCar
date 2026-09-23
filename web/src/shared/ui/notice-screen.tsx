import type { ReactNode } from "react";

import { PageShell } from "./page-shell";

interface NoticeScreenProps {
  readonly title: string;
  readonly children: ReactNode;
  /** The one thing to do about it, if any. */
  readonly action?: ReactNode;
}

/** A whole screen that says one thing: no network, update required. */
export function NoticeScreen({ title, children, action }: NoticeScreenProps) {
  return (
    <PageShell title={title}>
      <p className="text-sm">{children}</p>
      {action === undefined ? null : <div>{action}</div>}
    </PageShell>
  );
}
