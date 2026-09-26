import type { ReactNode } from "react";

import { type ButtonEmphasis, type ButtonSize, actionClassName } from "./action-class";

export type { ButtonEmphasis };

interface ActionButtonProps {
  /** Omitted for a `submit` button: the form's `onSubmit` is the action. */
  readonly onPress?: () => void;
  readonly submit?: boolean;
  readonly disabled?: boolean;
  /** `primary` is the brand colour and appears once per screen; the rest are ink and surface. */
  readonly emphasis?: ButtonEmphasis;
  /** 54 px by default, the main touch target; `compact` is the 44 px minimum. */
  readonly size?: ButtonSize;
  /** Working: disabled, with a spinner before the label the caller already put in the gerund. */
  readonly busy?: boolean;
  readonly icon?: ReactNode;
  /** The id of the form a `submit` button outside it submits, like one on a fixed bar. */
  readonly form?: string;
  readonly children: ReactNode;
}

export function ActionButton({
  onPress,
  submit = false,
  disabled = false,
  emphasis = "quiet",
  size = "default",
  busy = false,
  icon,
  form,
  children,
}: ActionButtonProps) {
  return (
    <button
      type={submit ? "submit" : "button"}
      form={form}
      onClick={onPress}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={actionClassName(emphasis, size)}
    >
      {busy ? <Spinner /> : icon}
      {children}
    </button>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden
      className="size-[18px] shrink-0 animate-spin rounded-full border-[2.5px] border-current border-r-transparent motion-reduce:animate-none"
    />
  );
}
