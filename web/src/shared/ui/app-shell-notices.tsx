import { useAppUpdate } from "../app/use-app-update";
import { useInstallHint } from "../app/use-install-hint";
import { ActionButton } from "./action-button";
import { ConfirmDialog } from "./confirm-dialog";
import { NoticeBar } from "./notice-bar";

/** The shell's quiet notices under the navigation: a new build waiting, how to install on iPhone. */
export function AppShellNotices() {
  const update = useAppUpdate();
  const hint = useInstallHint();
  return (
    <>
      {update.available ? (
        <NoticeBar actions={<ActionButton onPress={update.request}>Atualizar</ActionButton>}>
          Há uma versão nova do BrazCar.
        </NoticeBar>
      ) : null}
      {hint.visible ? (
        <NoticeBar
          actions={
            <ActionButton emphasis="quiet" onPress={hint.dismiss}>
              Agora não
            </ActionButton>
          }
        >
          Para abrir como app: toque em Compartilhar e depois em “Adicionar à Tela de Início”.
        </NoticeBar>
      ) : null}
      <ConfirmDialog
        open={update.confirming}
        onOpenChange={(open) => {
          if (!open) update.cancel();
        }}
        title="Atualizar agora?"
        description="O formulário aberto será perdido. Você pode terminar e atualizar depois."
        confirmLabel="Atualizar"
        onConfirm={update.confirm}
      />
    </>
  );
}
