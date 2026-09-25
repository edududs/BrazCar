import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { usePhoneInput } from "@/shared/app/use-phone-input";
import { ActionButton } from "@/shared/ui/action-button";
import { Form } from "@/shared/ui/form";
import { Icon } from "@/shared/ui/icon";
import { NoticeScreen } from "@/shared/ui/notice-screen";
import { PhoneField } from "@/shared/ui/phone-field";

import { requestPasswordReset } from "../adapters/accounts-gateway";
import { reasonOf } from "./reason";

/** Asks for the e-mailed link. Says the same thing whatever the phone: nothing to learn here. */
export function PasswordResetRequestForm() {
  const phone = usePhoneInput();
  const [state, setState] = useState<"idle" | "busy" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    setError(null);
    const e164 = phone.submitValue();
    if (e164 === null) return;
    setState("busy");
    requestPasswordReset(e164).then(
      () => {
        setState("sent");
      },
      (reason: unknown) => {
        setError(reasonOf(reason));
        setState("idle");
      },
    );
  };

  if (state === "sent") {
    return (
      <NoticeScreen
        title="Confira seu e-mail"
        glyph={<Icon name="mail" size={32} />}
        glyphTone="brand"
        action={
          <Link
            to="/entrar"
            className="inline-flex min-h-target w-full items-center justify-center rounded-button bg-surface-2 px-5 text-body font-semibold text-ink"
          >
            Voltar para entrar
          </Link>
        }
      >
        Enviamos o link para o e-mail cadastrado na conta. Não chegou em alguns minutos? Veja a
        caixa de spam. Se a conta não tem e-mail, nada é enviado.
      </NoticeScreen>
    );
  }
  return (
    <Form onSubmit={submit} error={error}>
      <PhoneField {...phone.field} label="Celular" />
      <ActionButton submit emphasis="primary" busy={state === "busy"}>
        Enviar link
      </ActionButton>
    </Form>
  );
}
