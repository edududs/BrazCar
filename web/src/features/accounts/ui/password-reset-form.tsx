import { useState } from "react";

import { ActionButton } from "@/shared/ui/action-button";
import { Form } from "@/shared/ui/form";
import { PasswordField } from "@/shared/ui/password-field";

import { confirmPasswordReset } from "../adapters/accounts-gateway";
import { reasonOf } from "./reason";

interface PasswordResetFormProps {
  readonly token: string;
  readonly onDone: () => void;
}

export function PasswordResetForm({ token, onDone }: PasswordResetFormProps) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    setError(null);
    setBusy(true);
    confirmPasswordReset(token, password).then(onDone, (reason: unknown) => {
      setError(reasonOf(reason));
      setBusy(false);
    });
  };

  return (
    <Form onSubmit={submit} error={error}>
      <PasswordField
        label="Nova senha"
        value={password}
        onChange={setPassword}
        autoComplete="new-password"
        hint="Pelo menos 8 caracteres."
      />
      <ActionButton submit emphasis="primary" busy={busy}>
        Salvar senha
      </ActionButton>
    </Form>
  );
}
