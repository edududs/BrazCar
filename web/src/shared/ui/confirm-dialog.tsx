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
}: ConfirmDialogProps) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fixed inset-0 bg-content/40" />
        <AlertDialog.Popup className="fixed top-1/2 left-1/2 flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-xl bg-surface p-5 text-content shadow-xl">
          <AlertDialog.Title className="text-lg font-semibold">{title}</AlertDialog.Title>
          <AlertDialog.Description className="text-sm">{description}</AlertDialog.Description>
          <div className="flex justify-end gap-2">
            <AlertDialog.Close
              disabled={busy}
              className="min-h-11 rounded-lg bg-neutral-soft px-4 text-sm font-medium text-content active:opacity-70 disabled:opacity-50"
            >
              Voltar
            </AlertDialog.Close>
            <ActionButton emphasis="critical" disabled={busy} onPress={onConfirm}>
              {confirmLabel}
            </ActionButton>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
