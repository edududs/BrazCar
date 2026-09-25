import { useRouterState } from "@tanstack/react-router";

import { useAppUpdate } from "../app/use-app-update";
import { useInstallHint } from "../app/use-install-hint";
import { ConfirmDialog } from "./confirm-dialog";
import { Icon } from "./icon";
import { InstallHintCard } from "./install-hint-card";
import { Toast, ToastAction } from "./toast";

/**
 * What the shell says over the page, without pushing it: a new build waiting, how to install on
 * iPhone, and the question before updating over an open form.
 */
export function ShellOverlays() {
  const update = useAppUpdate();
  const hint = useInstallHint();
  // The card floats over the bottom of the page, so it shows only on the board (S14), never over
  // the button that ends a form.
  const onBoard = useRouterState({ select: (state) => state.location.pathname === "/" });
  return (
    <>
      {update.available ? (
        <Toast
          icon={<Icon name="download" size={16} />}
          iconTone="brand"
          action={<ToastAction onPress={update.request}>Atualizar</ToastAction>}
        >
          Há uma versão nova do BrazCar.
        </Toast>
      ) : hint.visible && onBoard ? (
        <InstallHintCard onDismiss={hint.dismiss} />
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
