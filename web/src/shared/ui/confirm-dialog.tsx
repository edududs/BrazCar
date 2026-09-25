import { AlertDialog } from "@base-ui/react/alert-dialog";
import type { ReactNode } from "react";

import { ActionButton } from "./action-button";

interface ConfirmDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly title: string;
  readonly description: ReactNode;
  readonly confirmLabel: string;
  readonly onConfirm: () => void;
  readonly busy?: boolean;
  /** What the question is about, on a tile above the title. */
  readonly icon?: ReactNode;
}

/** A question with two answers, over Base UI (D-088): focus, escape and the backdrop are theirs. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  busy = false,
  icon,
}: ConfirmDialogProps) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fixed inset-0 bg-scrim transition-opacity duration-(--duration-enter) ease-out data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <AlertDialog.Popup className="fixed top-1/2 left-1/2 flex w-[calc(100%-2*var(--spacing-gutter))] max-w-sm -translate-x-1/2 -translate-y-1/2 flex-col gap-3 rounded-dialog bg-surface px-5 pt-6 pb-5 text-ink shadow-3 transition-[opacity,transform] duration-(--duration-enter) ease-out data-ending-style:scale-[.96] data-ending-style:opacity-0 data-starting-style:scale-[.96] data-starting-style:opacity-0 motion-reduce:data-ending-style:scale-100 motion-reduce:data-starting-style:scale-100">
          {icon === undefined ? null : (
            <span className="grid size-12 place-items-center rounded-button bg-critical-soft text-critical">
              {icon}
            </span>
          )}
          <AlertDialog.Title className="font-display text-heading font-bold text-balance">
            {title}
          </AlertDialog.Title>
          <AlertDialog.Description className="text-secondary text-ink-2">
            {description}
          </AlertDialog.Description>
          <div className="mt-2 flex flex-col gap-2">
            <ActionButton emphasis="critical-solid" disabled={busy} onPress={onConfirm}>
              {confirmLabel}
            </ActionButton>
            <AlertDialog.Close
              disabled={busy}
              className="inline-flex min-h-target items-center justify-center rounded-button bg-surface-2 px-5 text-body font-semibold text-ink transition-transform duration-(--duration-press) ease-out active:scale-[.97] disabled:opacity-[.42]"
            >
              Voltar
            </AlertDialog.Close>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
