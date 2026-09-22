import { useState } from "react";

import { ActionButton } from "@/shared/ui/action-button";
import { Form } from "@/shared/ui/form";
import { TextField } from "@/shared/ui/text-field";

import { requestPasswordReset } from "../adapters/accounts-gateway";
import { reasonOf } from "./reason";

/** Asks for the e-mailed link. Says the same thing whatever the phone: nothing to learn here. */
export function PasswordResetRequestForm() {
  const [phone, setPhone] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    setError(null);
    setState("busy");
    requestPasswordReset(phone).then(
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
      <TextField
        label="Telefone"
        value={phone}
        onChange={setPhone}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="61 99999-9999"
        hint="Enviamos o link para o e-mail cadastrado na conta."
        required
      />
      <ActionButton submit emphasis="primary" disabled={state === "busy"}>
        Enviar link
      </ActionButton>
    </Form>
  );
}
