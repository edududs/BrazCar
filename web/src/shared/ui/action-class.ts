export type ButtonEmphasis =
  "primary" | "ink" | "quiet" | "outline" | "ghost" | "critical" | "critical-solid";

export type ButtonSize = "default" | "compact";

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
} as const satisfies Record<ButtonSize, string>;

/** The look shared by `ActionButton` and `ActionLink` (D-168): one set of classes, so a link that
 * must look like a button never drifts from the button itself. */
export function actionClassName(emphasis: ButtonEmphasis, size: ButtonSize = "default"): string {
  return `inline-flex items-center justify-center gap-2 font-semibold whitespace-nowrap transition-transform duration-(--duration-press) ease-out active:scale-[.97] disabled:opacity-[.42] disabled:active:scale-100 ${sizeClass[size]} ${emphasisTone[emphasis]}`;
}
