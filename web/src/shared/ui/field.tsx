import { type ReactNode, useId } from "react";

import { Icon } from "./icon";

/** What the frame hands to its control: the id its label points at, and what describes it. */
export interface FieldControl {
  readonly id: string;
  readonly "aria-describedby": string | undefined;
  readonly "aria-invalid": true | undefined;
}

/**
 * How every form field frames itself: the label above, the control in its box, then help or the
 * refusal. The label names the control by id, and help and refusal describe it, so a screen
 * reader hears the name alone and the rest on request. Internal to `shared/ui`: the field
 * primitives compose it, views never see it.
 */
export interface FieldFrameProps {
  readonly label: ReactNode;
  readonly hint?: string | undefined;
  /** Why the value is refused; shown under the control and announced. */
  readonly error?: string | null | undefined;
  /** Something at the end of the hint line, like a character counter. */
  readonly aside?: ReactNode;
  /** Says the field may stay empty, beside the label. */
  readonly optional?: boolean;
  /** Something at the other end of the label line, like "Esqueci a senha". */
  readonly labelAside?: ReactNode;
  readonly children: (control: FieldControl) => ReactNode;
}

export function FieldFrame({
  label,
  hint,
  error = null,
  aside,
  optional = false,
  labelAside,
  children,
}: FieldFrameProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy =
    [hint === undefined ? null : hintId, error === null ? null : errorId]
      .filter((part) => part !== null)
      .join(" ") || undefined;
  return (
    <div className="flex flex-col gap-2 text-secondary font-semibold text-ink">
      <span className="flex items-baseline justify-between gap-2">
        <span className="flex items-baseline gap-1.5">
          <label htmlFor={id}>{label}</label>
          {optional ? <span className="text-sm font-medium text-ink-3">opcional</span> : null}
        </span>
        {labelAside}
      </span>
      {children({
        id,
        "aria-describedby": describedBy,
        "aria-invalid": error === null ? undefined : true,
      })}
      {hint === undefined && aside === undefined ? null : (
        <span className="flex justify-between gap-3 text-sm font-normal text-ink-3">
          <span id={hintId}>{hint}</span>
          {aside}
        </span>
      )}
      {error === null ? null : (
        <span
          id={errorId}
          role="alert"
          className="flex items-start gap-1.5 text-sm font-semibold text-critical"
        >
          <span className="mt-px">
            <Icon name="alert" size={16} />
          </span>
          {error}
        </span>
      )}
    </div>
  );
}

interface BoxProps {
  /** Before the control: a unit or a country code, "R$", "+55". */
  readonly prefix?: ReactNode;
  /** After the control: an icon, a button that reveals a password. */
  readonly suffix?: ReactNode;
  readonly invalid?: boolean;
  readonly readOnly?: boolean;
  /** `input` sits on one line; `textarea` grows and needs vertical padding. */
  readonly multiline?: boolean;
  readonly children: ReactNode;
}

/** The box around a control: 56 px, a line, the brand ring on focus, the critical ring on error. */
export function Box({
  prefix,
  suffix,
  invalid = false,
  readOnly = false,
  multiline = false,
  children,
}: BoxProps) {
  const state = invalid
    ? "border-critical focus-within:ring-4 focus-within:ring-critical-ring"
    : readOnly
      ? "border-transparent bg-surface-2 text-ink-2"
      : "border-line-strong focus-within:border-brand focus-within:ring-4 focus-within:ring-ring";
  return (
    <span
      className={`flex w-full items-center gap-2.5 rounded-field border-[1.5px] bg-surface px-4 text-body font-normal text-ink ${multiline ? "py-3.5" : "min-h-14"} ${state}`}
    >
      {prefix === undefined ? null : (
        <span aria-hidden className="shrink-0 font-semibold text-ink-3">
          {prefix}
        </span>
      )}
      {children}
      {suffix === undefined ? null : <span className="shrink-0 text-ink-3">{suffix}</span>}
    </span>
  );
}

/** The control inside a `Box`: bare, the box draws everything. */
export const controlClass =
  "min-w-0 flex-1 appearance-none bg-transparent p-0 text-body text-ink outline-none placeholder:text-ink-3";
