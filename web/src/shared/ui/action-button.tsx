import type { ReactNode } from "react";

interface ActionButtonProps {
  readonly onPress: () => void;
  readonly emphasis?: "primary" | "quiet";
  readonly children: ReactNode;
}

const emphasisTone = {
  primary: "bg-content text-surface",
  quiet: "bg-neutral-soft text-content",
} as const;

export function ActionButton({ onPress, emphasis = "quiet", children }: ActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onPress}
      className={`min-h-11 rounded-lg px-4 text-sm font-medium active:opacity-70 ${emphasisTone[emphasis]}`}
    >
      {children}
    </button>
  );
}
