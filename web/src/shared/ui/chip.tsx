import type { ReactNode } from "react";

import { Icon } from "./icon";

interface ChipProps {
  readonly children: ReactNode;
  /** On: ink on the page colour. Off: a line around it. */
  readonly pressed?: boolean;
  /** A filter that opens something to be set, rather than a switch: dashed while unset. */
  readonly dashed?: boolean;
  readonly icon?: ReactNode;
  /** When on, the chip clears on press: it shows an × to say so. */
  readonly clears?: boolean;
  readonly onPress: () => void;
}

/** A filter as a pill: 44 px tall, pressed or not (F4). */
export function Chip({
  children,
  pressed = false,
  dashed = false,
  icon,
  clears = false,
  onPress,
}: ChipProps) {
  const look = pressed
    ? "border-ink bg-ink text-bg"
    : dashed
      ? "border-dashed border-line text-ink-2"
      : "border-line bg-surface text-ink";
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onPress}
      className={`inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border-[1.5px] px-4 text-secondary font-semibold whitespace-nowrap transition-[background-color,transform] duration-(--duration-state) ease-out active:scale-[.97] ${look}`}
    >
      {icon}
      {children}
      {pressed && clears ? <Icon name="x" size={16} /> : null}
    </button>
  );
}

/** The row the chips scroll in, bleeding into the gutters. */
export function ChipRow({ children }: { readonly children: ReactNode }) {
  return (
    <div className="-mx-gutter flex shrink-0 gap-2 overflow-x-auto px-gutter py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {children}
    </div>
  );
}
