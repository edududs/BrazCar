import { ActionButton } from "@/shared/ui/action-button";
import { Form } from "@/shared/ui/form";
import { Icon } from "@/shared/ui/icon";
import { NoticeScreen } from "@/shared/ui/notice-screen";
import { PageShell } from "@/shared/ui/page-shell";
import { PhoneField } from "@/shared/ui/phone-field";
import { TextAreaField } from "@/shared/ui/textarea-field";

import { useRemovalRequest } from "../app/use-removal-request";
import { REMOVAL_NOTE_LIMIT } from "../domain/removal-request";

/**
 * The public removal request (D-162, D-172): whoever posted an offer in a WhatsApp group the
 * BrazCar reads asks their number to leave the board. Open without a session, since the person it
 * is for never made an account here. Nothing is removed on the spot, and nothing here ever says
 * whether the number has rides on the board: every well-formed request ends the same way.
 */
export function RemovalRequestScreen() {
  const form = useRemovalRequest();

  if (form.state === "sent") {
    return (
      <NoticeScreen
        title="Pedido recebido"
        glyph={<Icon name="check" size={32} />}
        glyphTone="brand"
      >
        O pedido vai ser conferido antes de valer. Se for aprovado, as caronas desse número saem do
        mural e as próximas não entram mais. Não há prazo, e não há como avisar quando terminar: não
        existe um canal de volta por aqui.
      </NoticeScreen>
    );
  }

  return (
    <PageShell
      title="Sair do mural"
      back={{ to: "/", icon: "back", label: "Voltar" }}
      intro="Esta carona aparece no mural porque foi anunciada num grupo de WhatsApp de onde o BrazCar lê ofertas. Pedir a remoção tira as caronas desse número do mural e faz as próximas deixarem de ser lidas. O pedido é conferido antes de valer."
    >
      <Form onSubmit={form.submit} error={form.error}>
        <PhoneField {...form.phone} label="Celular" />
        <TextAreaField
          label="Quer explicar algo?"
          value={form.note}
          onChange={form.setNote}
          rows={4}
          maxLength={REMOVAL_NOTE_LIMIT}
          optional
        />
        <ActionButton submit emphasis="primary" busy={form.state === "busy"}>
          Pedir remoção
        </ActionButton>
      </Form>
    </PageShell>
  );
}
