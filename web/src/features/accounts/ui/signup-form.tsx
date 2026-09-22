import { useState } from "react";

import { ActionButton } from "@/shared/ui/action-button";
import { CheckboxField } from "@/shared/ui/checkbox-field";
import { Form } from "@/shared/ui/form";
import { TextField } from "@/shared/ui/text-field";

import type { Account, SignupData } from "../domain/account";
import { reasonOf } from "./reason";

interface SignupFormProps {
  readonly signUp: (data: SignupData) => Promise<Account>;
  readonly busy: boolean;
  readonly onDone: (account: Account) => void;
}

export function SignupForm({ signUp, busy, onDone }: SignupFormProps) {
  const [data, setData] = useState<SignupData>({
    phone: "",
    password: "",
    displayName: "",
    email: "",
    acceptsTerms: false,
  });
  const [error, setError] = useState<string | null>(null);
  const set =
    <K extends keyof SignupData>(key: K) =>
    (value: SignupData[K]) => {
      setData((current) => ({ ...current, [key]: value }));
    };

  const submit = () => {
    setError(null);
    signUp(data).then(onDone, (reason: unknown) => {
      setError(reasonOf(reason));
    });
  };

  return (
    <Form onSubmit={submit} error={error}>
      <TextField
        label="Telefone"
        value={data.phone}
        onChange={set("phone")}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="61 99999-9999"
        hint="É o número que vai receber as mensagens no WhatsApp."
        required
      />
      <TextField
        label="Nome"
        value={data.displayName}
        onChange={set("displayName")}
        autoComplete="name"
        hint="É o único nome que aparece no mural."
        required
      />
      <TextField
        label="Senha"
        value={data.password}
        onChange={set("password")}
        type="password"
        autoComplete="new-password"
        hint="Pelo menos 8 caracteres."
        required
      />
      <TextField
        label="E-mail (opcional)"
        value={data.email}
        onChange={set("email")}
        type="email"
        inputMode="email"
        autoComplete="email"
        hint="Só para recuperar a senha."
      />
      <CheckboxField checked={data.acceptsTerms} onChange={set("acceptsTerms")}>
        Li e aceito os termos de uso e a política de privacidade.
      </CheckboxField>
      <ActionButton submit emphasis="primary" disabled={busy || !data.acceptsTerms}>
        Criar conta
      </ActionButton>
    </Form>
  );
}
