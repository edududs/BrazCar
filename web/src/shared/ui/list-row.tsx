import { Link, type LinkProps } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { Icon } from "./icon";

/** Rows on one surface, like the groups of the phone's settings (S05, S10). */
export function ListGroup({ children }: { readonly children: ReactNode }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-card border border-line-soft bg-surface shadow-1 [&>*+*]:border-t [&>*+*]:border-line-soft">
      {children}
    </div>
  );
}

type RowTone = "default" | "brand" | "critical";

interface RowBodyProps {
  readonly icon: ReactNode;
  readonly title: string;
  readonly subtitle?: string | undefined;
  readonly tone?: RowTone;
  /** A chevron at the end says the row leads somewhere. */
  readonly leads?: boolean;
}

const rowClass =
  "flex min-h-[60px] w-full items-center gap-3 px-4 py-2 text-left text-body font-medium";
const tones = {
  default: { row: "text-ink", tile: "bg-surface-2 text-ink-2" },
  brand: { row: "text-brand-ink font-semibold", tile: "bg-brand-soft text-brand-ink" },
  critical: { row: "text-critical", tile: "bg-critical-soft text-critical" },
} as const satisfies Record<RowTone, { row: string; tile: string }>;

function RowBody({ icon, title, subtitle, tone = "default", leads = false }: RowBodyProps) {
  return (
    <>
      <span
        className={`grid size-[38px] shrink-0 place-items-center rounded-[12px] ${tones[tone].tile}`}
      >
        {icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span>{title}</span>
        {subtitle === undefined ? null : (
          <span className="text-sm font-medium text-ink-3">{subtitle}</span>
        )}
      </span>
      {leads ? (
        <span className="text-ink-3">
          <Icon name="chevron-right" />
        </span>
      ) : null}
    </>
  );
}

interface ListRowButtonProps extends RowBodyProps {
  readonly onPress: () => void;
  readonly disabled?: boolean;
}

export function ListRowButton({
  onPress,
  disabled = false,
  tone = "default",
  ...body
}: ListRowButtonProps) {
  return (
    <button
      type="button"
      onClick={onPress}
      disabled={disabled}
      className={`${rowClass} ${tones[tone].row} disabled:opacity-[.42]`}
    >
      <RowBody tone={tone} {...body} />
    </button>
  );
}

interface ListRowLinkProps extends RowBodyProps {
  readonly to: NonNullable<LinkProps["to"]>;
  readonly params?: LinkProps["params"];
}

export function ListRowLink({ to, params, tone = "default", ...body }: ListRowLinkProps) {
  return (
    <Link
      to={to}
      {...(params === undefined ? {} : { params })}
      className={`${rowClass} ${tones[tone].row}`}
    >
      <RowBody tone={tone} leads {...body} />
    </Link>
  );
}
