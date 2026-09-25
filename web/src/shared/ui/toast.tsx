import type { ReactNode } from "react";

interface ToastProps {
  readonly children: ReactNode;
  /** A small tile before the text: a check, a download arrow. */
  readonly icon?: ReactNode;
  readonly iconTone?: "positive" | "brand";
  /** One short verb at the end, when there is something to do about it. */
  readonly action?: ReactNode;
  /** `status` by default; `alert` when it must interrupt, like losing the network. */
  readonly role?: "status" | "alert";
  /** Above the tab bar by default; `top` sits under the status bar instead. */
  readonly placement?: "bottom" | "top";
}

const iconTones = {
  positive: "bg-positive text-surface",
  brand: "bg-brand text-on-brand",
} as const;

/** A line that floats over the page, in ink: a new build, a "done", the network gone. */
export function Toast({
  children,
  icon,
  iconTone = "positive",
  action,
  role = "status",
  placement = "bottom",
}: ToastProps) {
  const position =
    placement === "top"
      ? "top-[calc(env(safe-area-inset-top)+0.75rem)]"
      : "bottom-[calc(env(safe-area-inset-bottom)+5.5rem)]";
  return (
    <div
      role={role}
      className={`fixed inset-x-3.5 z-30 mx-auto flex min-h-[60px] max-w-md animate-rise-in items-center gap-3 rounded-[18px] bg-ink py-2.5 pr-2.5 pl-4 text-secondary font-semibold text-bg shadow-3 ${position}`}
    >
      {icon === undefined ? null : (
        <span
          className={`grid size-[26px] shrink-0 place-items-center rounded-full ${iconTones[iconTone]}`}
        >
          {icon}
        </span>
      )}
      <span className="flex-1 leading-[1.3]">{children}</span>
      {action}
    </div>
  );
}

/** The button a toast carries: brand on ink, no box. */
export function ToastAction({
  onPress,
  children,
}: {
  readonly onPress: () => void;
  readonly children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onPress}
      className="grid min-h-10 place-items-center rounded-[12px] px-3 text-secondary font-bold text-brand-on-ink"
    >
      {children}
    </button>
  );
}
