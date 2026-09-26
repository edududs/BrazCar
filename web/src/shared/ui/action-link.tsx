import { Link, type LinkProps } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { type ButtonEmphasis, type ButtonSize, actionClassName } from "./action-class";

interface ActionLinkProps {
  readonly to: NonNullable<LinkProps["to"]>;
  readonly params?: LinkProps["params"];
  /** `primary` is the brand colour and appears once per screen; the rest are ink and surface. */
  readonly emphasis?: ButtonEmphasis;
  /** 54 px by default, the main touch target; `compact` is the 44 px minimum. */
  readonly size?: ButtonSize;
  readonly icon?: ReactNode;
  readonly children: ReactNode;
}

/** An action that happens to be a navigation: the exact look of `ActionButton`, so a link never
 * gets away with raw classes of its own (D-168). */
export function ActionLink({
  to,
  params,
  emphasis = "quiet",
  size = "default",
  icon,
  children,
}: ActionLinkProps) {
  return (
    <Link
      to={to}
      {...(params === undefined ? {} : { params })}
      className={actionClassName(emphasis, size)}
    >
      {icon}
      {children}
    </Link>
  );
}
