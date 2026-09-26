import { useState } from "react";

import { ActionButton } from "@/shared/ui/action-button";
import { Icon } from "@/shared/ui/icon";
import { NoticeBar } from "@/shared/ui/notice-bar";
import { NoticeScreen } from "@/shared/ui/notice-screen";

import { reasonOf } from "./reason";

interface InviteSentScreenProps {
  /** Typed this session, or the API's own mask when a reload catches the invite already
   * awaiting one (D-166). */
  readonly email: string;
  /** `false` without a plain address to send again: only "usar outro e-mail" moves on. */
  readonly canResend: boolean;
  readonly sending: boolean;
  readonly resend: () => Promise<void>;
  readonly useAnotherEmail: () => void;
}

/** Sent this session, or found already awaiting on a reload: the same screen either way, since
 * neither the person nor the API distinguishes them (D-166). */
export function InviteSentScreen({
  email,
  canResend,
  sending,
  resend,
  useAnotherEmail,
}: InviteSentScreenProps) {
  const [error, setError] = useState<string | null>(null);

  return (
    <NoticeScreen
      title="Confirme seu e-mail"
      glyph={<Icon name="mail" size={32} />}
      glyphTone="brand"
      action={
        <div className="flex flex-col gap-3">
          {error === null ? null : (
            <NoticeBar tone="critical" role="alert">
              {error}
            </NoticeBar>
          )}
          <ActionButton
            emphasis="outline"
            busy={sending}
            disabled={!canResend}
            icon={<Icon name="refresh" size={16} />}
            onPress={() => {
              setError(null);
              resend().catch((reason: unknown) => {
                setError(reasonOf(reason));
              });
            }}
          >
            Reenviar
          </ActionButton>
          <ActionButton emphasis="quiet" onPress={useAnotherEmail}>
            Usar outro e-mail
          </ActionButton>
        </div>
      }
    >
      Mandamos um link para {email}. Ele vale 2 horas: é só abrir no celular.
    </NoticeScreen>
  );
}
