import { Link, type LinkProps } from "@tanstack/react-router";

import { Icon, type IconName } from "./icon";

interface IconButtonProps {
  readonly icon: IconName;
  /** What it does, for assistive technology: the only name it has. */
  readonly label: string;
  readonly onPress: () => void;
  readonly disabled?: boolean;
  /** `filled` sits on a surface-2 disc; `plain` has no disc, for a row's end. */
  readonly look?: "filled" | "plain";
}

const looks = {
  filled: "bg-surface-2",
  plain: "bg-transparent",
} as const;

/** A 44 px round button with one icon. */
export function IconButton({
  icon,
  label,
  onPress,
  disabled = false,
  look = "filled",
}: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onPress}
      disabled={disabled}
      className={`grid size-11 shrink-0 place-items-center rounded-full text-ink disabled:opacity-[.42] ${looks[look]}`}
    >
      <Icon name={icon} />
    </button>
  );
}

interface IconLinkProps {
  readonly icon: IconName;
  readonly label: string;
  readonly to: NonNullable<LinkProps["to"]>;
  readonly params?: LinkProps["params"];
}

/** The same disc, leading somewhere: the way back at the top of a stacked page. */
export function IconLink({ icon, label, to, params }: IconLinkProps) {
  return (
    <Link
      to={to}
      {...(params === undefined ? {} : { params })}
      aria-label={label}
      className="grid size-11 shrink-0 place-items-center rounded-full bg-surface-2 text-ink"
    >
      <Icon name={icon} />
    </Link>
  );
}
