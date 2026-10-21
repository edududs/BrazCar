import type { ReactNode } from "react";

import { devicePushView } from "../app/device-push-view";
import type { DevicePush } from "../app/use-device-push";
import { ActionButton } from "./action-button";
import { Icon } from "./icon";
import { InstallSteps } from "./install-steps";
import { NoticeBar } from "./notice-bar";

interface DevicePushControlProps {
  readonly push: DevicePush;
  /** Whether the buttons that turn notifications on and off are drawn; off, it only says the state. */
  readonly actions?: boolean;
}

function Line({ children }: { readonly children: ReactNode }) {
  return <p className="text-secondary text-ink-2">{children}</p>;
}

/** What this device does with notifications, and (with `actions`) the way to turn them on or off. */
export function DevicePushControl({ push, actions = true }: DevicePushControlProps) {
  return (
    <div className="flex flex-col gap-3">
      <State push={push} actions={actions} />
      {push.error === null ? null : (
        <NoticeBar tone="caution" role="alert">
          {push.error}
        </NoticeBar>
      )}
    </div>
  );
}

function State({ push, actions }: { readonly push: DevicePush; readonly actions: boolean }) {
  switch (devicePushView(push)) {
    case "unsupported":
      return <Line>Este navegador não recebe notificações.</Line>;
    case "needs-install":
      return (
        <Line>
          No iPhone, adicione o BrazCar à Tela de Início para receber avisos. <InstallSteps />
        </Line>
      );
    case "blocked":
      return <Line>Notificações bloqueadas. Libere nos ajustes do navegador.</Line>;
    case "checking":
      return actions ? <Line>Verificando este aparelho…</Line> : null;
    case "off":
      return actions ? (
        <ActionButton
          size="compact"
          icon={<Icon name="bell" />}
          busy={push.pending}
          onPress={() => {
            void push.enable();
          }}
        >
          Ativar notificações
        </ActionButton>
      ) : null;
    case "on":
      return (
        <>
          <Line>Notificações ligadas neste aparelho</Line>
          {actions ? (
            <ActionButton
              size="compact"
              busy={push.pending}
              onPress={() => {
                void push.disable();
              }}
            >
              Desligar
            </ActionButton>
          ) : null}
        </>
      );
  }
}
