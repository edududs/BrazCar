import type { ReactNode } from "react";

export type ButtonEmphasis =
  "primary" | "ink" | "quiet" | "outline" | "ghost" | "critical" | "critical-solid";

interface ActionButtonProps {
  /** Omitted for a `submit` button: the form's `onSubmit` is the action. */
  readonly onPress?: () => void;
  readonly submit?: boolean;
  readonly disabled?: boolean;
  /** `primary` is the brand colour and appears once per screen; the rest are ink and surface. */
  readonly emphasis?: ButtonEmphasis;
  /** 54 px by default, the main touch target; `compact` is the 44 px minimum. */
  readonly size?: "default" | "compact";
  /** Working: disabled, with a spinner before the label the caller already put in the gerund. */
  readonly busy?: boolean;
  readonly icon?: ReactNode;
  /** The id of the form a `submit` button outside it submits, like one on a fixed bar. */
  readonly form?: string;
  readonly children: ReactNode;
}

const emphasisTone = {
  primary: "bg-brand text-on-brand",
  ink: "bg-ink text-bg",
  quiet: "bg-surface-2 text-ink",
  outline: "bg-transparent text-ink inset-ring-[1.5px] inset-ring-line-strong",
  ghost: "bg-transparent text-brand-ink",
  critical: "bg-critical-soft text-critical",
  "critical-solid": "bg-critical text-surface",
} as const satisfies Record<ButtonEmphasis, string>;

const sizeClass = {
  default: "min-h-target rounded-button px-5 text-body",
  compact: "min-h-11 rounded-field px-4 text-secondary",
} as const;

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
      className={`inline-flex items-center justify-center gap-2 font-semibold whitespace-nowrap transition-transform duration-(--duration-press) ease-out active:scale-[.97] disabled:opacity-[.42] disabled:active:scale-100 ${sizeClass[size]} ${emphasisTone[emphasis]}`}
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
