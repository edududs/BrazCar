import { useState } from "react";

import { ActionButton } from "@/shared/ui/action-button";
import { CheckboxField } from "@/shared/ui/checkbox-field";
import { Form } from "@/shared/ui/form";
import { Icon } from "@/shared/ui/icon";
import { PhoneField } from "@/shared/ui/phone-field";
import { Segmented, type SegmentedOption } from "@/shared/ui/segmented";
import { Sheet } from "@/shared/ui/sheet";
import { TextAreaField } from "@/shared/ui/textarea-field";
import { Toast } from "@/shared/ui/toast";

import { useFeedbackDraft } from "../app/use-feedback-draft";
import { useSendFeedback } from "../app/use-send-feedback";
import { FEEDBACK_LIMIT, type FeedbackKind, FeedbackRequestError } from "../domain/feedback";

const KINDS: readonly SegmentedOption<FeedbackKind>[] = [
  { value: "suggestion", label: "Sugestão" },
  { value: "complaint", label: "Reclamação" },
  { value: "praise", label: "Elogio" },
];

const PLACEHOLDERS: Record<FeedbackKind, string> = {
  suggestion: "O que faria diferença no seu dia?",
  complaint: "Conte o que aconteceu.",
  praise: "O que está funcionando bem?",
};

export const RECEIVED = "Recebido. Obrigado por contar.";

interface FeedbackSheetProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

/**
 * An opinion about the app, from the account screen (D-155). Nothing is answered back, and whoever
 * a complaint names is never told: the sheet says so before anyone writes.
 */
export function FeedbackSheet({ open, onOpenChange }: FeedbackSheetProps) {
  const [received, setReceived] = useState(false);
  return (
    <>
      <Sheet
        open={open}
        onOpenChange={onOpenChange}
        title="Enviar opinião"
        description="Sobre o app: o que falta, o que atrapalha, o que funciona. A equipe lê tudo, mas não responde por aqui."
      >
        {open ? (
          <FeedbackForm
            onSent={() => {
              onOpenChange(false);
              setReceived(true);
              window.setTimeout(() => {
                setReceived(false);
              }, 4000);
            }}
          />
        ) : null}
      </Sheet>
      {received ? <Toast icon={<Icon name="check" size={16} />}>{RECEIVED}</Toast> : null}
    </>
  );
}

function FeedbackForm({ onSent }: { readonly onSent: () => void }) {
  const draft = useFeedbackDraft();
  const { send, busy } = useSendFeedback();
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    setError(null);
    const data = draft.submitValue();
    if (data === null) return;
    send(data).then(onSent, (reason: unknown) => {
      setError(
        reason instanceof FeedbackRequestError
          ? reason.message
          : "Sem resposta do serviço. Tente de novo.",
      );
    });
  };

  return (
    <Form onSubmit={submit} error={error}>
      <Segmented
        label="Tipo de opinião"
        options={KINDS}
        value={draft.kind}
        onChange={draft.setKind}
      />
      <TextAreaField
        label="Sua opinião"
        value={draft.message}
        onChange={draft.setMessage}
        placeholder={PLACEHOLDERS[draft.kind]}
        rows={5}
        maxLength={FEEDBACK_LIMIT}
        error={draft.messageError}
      />
      {draft.canNameSomeone ? (
        <CheckboxField checked={draft.aboutSomeone} onChange={draft.setAboutSomeone}>
          É sobre alguém específico
        </CheckboxField>
      ) : null}
      {draft.aboutSomeone ? (
        <PhoneField
          {...draft.phone}
          label="Celular de quem é"
          hint="O celular, porque o nome pode mudar. A pessoa não é avisada."
        />
      ) : null}
      <ActionButton submit emphasis="primary" busy={busy}>
        Enviar opinião
      </ActionButton>
    </Form>
  );
}
