import { ConfirmDialog } from "@/shared/ui/confirm-dialog";
import { Icon } from "@/shared/ui/icon";

interface DeleteAccountDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly phoneDisplay: string;
  readonly busy: boolean;
  readonly onConfirm: () => void;
}

/**
 * The same question and consequence wherever an account can end itself: the panel a working
 * account sees, and the screen a held one sees instead of it (D-168). One place, so the wording
 * never drifts between them.
 */
export function DeleteAccountDialog({
  open,
  onOpenChange,
  phoneDisplay,
  busy,
  onConfirm,
}: DeleteAccountDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Excluir sua conta?"
      description={
        <>
          A conta some e as caronas publicadas por ela saem do mural. Esta ação não pode ser
          desfeita. Depois disso, o celular <b className="text-ink tabular-nums">{phoneDisplay}</b>{" "}
          não entra mais com esta senha.
        </>
      }
      confirmLabel="Excluir conta"
      busy={busy}
      icon={<Icon name="alert" size={24} />}
      onConfirm={onConfirm}
    />
  );
}
