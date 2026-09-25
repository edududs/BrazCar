import type { ReactNode } from "react";

import { Icon, type IconName } from "./icon";

export type NoticeTone = "info" | "caution" | "critical" | "positive" | "neutral";

interface NoticeBarProps {
  readonly children: ReactNode;
  readonly tone?: NoticeTone;
  /** `status` by default; `alert` for a refusal that must be announced at once. */
  readonly role?: "status" | "alert";
  /** Buttons under the text, when the notice offers one. */
  readonly actions?: ReactNode;
}

const tones = {
  info: { className: "bg-brand-soft text-brand-ink", icon: "info" },
  caution: { className: "bg-caution-soft text-caution", icon: "clock" },
  critical: { className: "bg-critical-soft text-critical", icon: "alert" },
  positive: { className: "bg-positive-soft text-positive", icon: "check" },
  neutral: { className: "bg-surface-2 text-ink-2", icon: "info" },
} as const satisfies Record<NoticeTone, { className: string; icon: IconName }>;

/** A line in the flow of the page that says one thing: a change, a limit, a refusal, a "done". */
export function NoticeBar({ children, tone = "info", role = "status", actions }: NoticeBarProps) {
  const { className, icon } = tones[tone];
  return (
    <aside role={role} className={`flex gap-3 rounded-button px-4 py-3.5 ${className}`}>
      <span className="mt-0.5">
        <Icon name={icon} />
      </span>
      <div className="flex flex-1 flex-col gap-2.5 text-secondary">
        <p>{children}</p>
        {actions === undefined ? null : <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </aside>
  );
}
