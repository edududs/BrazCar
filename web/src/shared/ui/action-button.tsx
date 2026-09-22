import type { ReactNode } from "react";

interface ActionButtonProps {
  /** Omitted for a `submit` button: the form's `onSubmit` is the action. */
  readonly onPress?: () => void;
  readonly submit?: boolean;
  readonly disabled?: boolean;
  readonly emphasis?: "primary" | "quiet" | "critical";
  readonly children: ReactNode;
}

const emphasisTone = {
  primary: "bg-content text-surface",
  quiet: "bg-neutral-soft text-content",
  critical: "bg-critical-soft text-critical",
} as const;

export function ActionButton({
  onPress,
  submit = false,
  disabled = false,
  emphasis = "quiet",
  children,
}: ActionButtonProps) {
  return (
    <button
      type={submit ? "submit" : "button"}
      onClick={onPress}
      disabled={disabled}
      className={`min-h-11 rounded-lg px-4 text-sm font-medium active:opacity-70 disabled:opacity-50 ${emphasisTone[emphasis]}`}
    >
      {children}
    </button>
  );
}
