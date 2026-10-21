import { useId } from "react";

import { HeldNotice } from "@/features/accounts/ui/held-notice";
import { useSession } from "@/features/accounts/app/use-session";
import { useDevicePush } from "@/shared/app/use-device-push";
import { AccountHeldError, HELD_MESSAGE } from "@/shared/domain/account-held";
import { ActionButton } from "@/shared/ui/action-button";
import { ActionLink } from "@/shared/ui/action-link";
import { ClockPicker } from "@/shared/ui/clock-picker";
import { DevicePushControl } from "@/shared/ui/device-push-control";
import { Form } from "@/shared/ui/form";
import { Segmented } from "@/shared/ui/segmented";
import { Sheet } from "@/shared/ui/sheet";
import { SwitchField } from "@/shared/ui/switch-field";
import { TextField } from "@/shared/ui/text-field";

import { type AlertSeed, type ClockSlot, useAlertDraft } from "../app/use-alert-draft";
import { useAlertRequest } from "../app/use-alert-request";
import { AlertRequestError } from "../domain/alert";

const TITLE = "Me avise";
const DESCRIPTION =
  "Uma notificação quando entrar no mural carona com vaga que combine com isto. Vale só para o dia escolhido.";
const CREATED_TITLE = "Aviso criado.";
const CREATED_DESCRIPTION =
  "Quando entrar no mural uma carona com vaga que combine, a notificação chega aos aparelhos em que você ligou as notificações.";
const NO_ANSWER = "Sem resposta do serviço. Tente de novo.";
const TEXT_LIMIT = 80;
const MINUTE_STEP = 15;

interface AlertSheetProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** What the board shows now: the sheet starts from it. */
  readonly seed: AlertSeed;
  readonly now: Date;
  /** The board's current address, to come back to after signing in. */
  readonly returnTo: string;
}

/**
 * "Me avise": asks for a notification when a ride that fits shows up on the board. Who is not
 * signed in is invited to; a held account is told what it owes (D-168) before any permission is
 * asked for an alert the API would refuse.
 */
export function AlertSheet({ open, onOpenChange, seed, now, returnTo }: AlertSheetProps) {
  const { session } = useSession();
  if (open && session.status === "signed-in" && session.account.requiredAction === null) {
    return (
      <AccountAlertSheet
        accountId={session.account.id}
        onOpenChange={onOpenChange}
        seed={seed}
        now={now}
      />
    );
  }
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={TITLE} description={DESCRIPTION}>
      {session.status === "checking" ? (
        <p className="text-secondary text-ink-2">Verificando…</p>
      ) : session.status === "anonymous" ? (
        <>
          <p className="text-secondary text-ink-2">
            Entre para ser avisado quando aparecer carona.
          </p>
          <ActionLink to="/entrar" search={{ returnTo }} emphasis="primary">
            Entrar
          </ActionLink>
        </>
      ) : session.account.requiredAction === null ? null : (
        <HeldNotice message={HELD_MESSAGE} />
      )}
    </Sheet>
  );
}

interface AccountAlertSheetProps {
  readonly accountId: string;
  readonly onOpenChange: (open: boolean) => void;
  readonly seed: AlertSeed;
  readonly now: Date;
}

/** Mounted only while the sheet is open, so the draft starts fresh from the board each time. */
function AccountAlertSheet({ accountId, onOpenChange, seed, now }: AccountAlertSheetProps) {
  const formId = useId();
  const push = useDevicePush();
  const draft = useAlertDraft({ seed, now });
  const request = useAlertRequest({ accountId, push });
  const close = () => {
    onOpenChange(false);
  };

  if (request.phase === "created") {
    return (
      <Sheet
        open
        onOpenChange={onOpenChange}
        title={CREATED_TITLE}
        description={CREATED_DESCRIPTION}
        footer={
          <ActionButton emphasis="primary" onPress={close}>
            Pronto
          </ActionButton>
        }
      >
        <DevicePushControl push={push} />
      </Sheet>
    );
  }

  const held = request.error instanceof AccountHeldError;
  return (
    <Sheet
      open
      onOpenChange={onOpenChange}
      title={TITLE}
      description={DESCRIPTION}
      footer={
        <div className="flex gap-2.5">
          <div className="flex-1">
            <ActionButton emphasis="quiet" onPress={close}>
              Cancelar
            </ActionButton>
          </div>
          <div className="flex-[2]">
            <ActionButton submit form={formId} emphasis="primary" busy={request.busy}>
              Criar aviso
            </ActionButton>
          </div>
        </div>
      }
    >
      <Form
        id={formId}
        onSubmit={() => {
          request.submit(draft.value());
        }}
        error={held ? null : failureOf(request.error)}
      >
        <Segmented
          label="Dia"
          options={draft.dayOptions.map((option) => ({ value: option.day, label: option.label }))}
          value={draft.day}
          onChange={draft.setDay}
        />
        <TextField
          label="Passa por"
          optional
          value={draft.text}
          onChange={draft.setText}
          placeholder="Esplanada, Incra 8, SIA"
          maxLength={TEXT_LIMIT}
        />
        <ClockOption label="A partir de" slot={draft.from} />
        <ClockOption label="Até" slot={draft.until} />
        <DevicePushControl push={push} actions={false} />
        {held ? <HeldNotice message={request.error.message} /> : null}
      </Form>
    </Sheet>
  );
}

/** The sentence of a refusal: the API's own, or ours when nothing answered. */
function failureOf(error: unknown): string | null {
  if (error === null || error === undefined) return null;
  return error instanceof AlertRequestError ? error.message : NO_ANSWER;
}

function ClockOption({ label, slot }: { readonly label: string; readonly slot: ClockSlot }) {
  return (
    <>
      <SwitchField checked={slot.on} onChange={slot.setOn}>
        {label}
      </SwitchField>
      {slot.on ? <ClockPicker label={label} draft={slot.time} minuteStep={MINUTE_STEP} /> : null}
    </>
  );
}
