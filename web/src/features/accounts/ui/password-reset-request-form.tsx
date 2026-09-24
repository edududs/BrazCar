import { useState } from "react";

import { usePhoneInput } from "@/shared/app/use-phone-input";
import { ActionButton } from "@/shared/ui/action-button";
import { Form } from "@/shared/ui/form";
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
      <p className="text-sm">
        Se este telefone tiver conta com e-mail, o link para redefinir a senha já foi enviado.
      </p>
    );
  }
  return (
    <Form onSubmit={submit} error={error}>
      <PhoneField {...phone.field} hint="Enviamos o link para o e-mail cadastrado na conta." />
      <ActionButton submit emphasis="primary" disabled={state === "busy"}>
        Enviar link
      </ActionButton>
    </Form>
  );
}
