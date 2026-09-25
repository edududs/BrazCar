import { useState } from "react";

import { usePhoneInput } from "@/shared/app/use-phone-input";
import { ActionButton } from "@/shared/ui/action-button";
import { CheckboxField } from "@/shared/ui/checkbox-field";
import { Form } from "@/shared/ui/form";
import { PasswordField } from "@/shared/ui/password-field";
import { PhoneField } from "@/shared/ui/phone-field";
import { TextField } from "@/shared/ui/text-field";

import type { Account, SignupData } from "../domain/account";
import { reasonOf } from "./reason";

interface SignupFormProps {
  readonly signUp: (data: SignupData) => Promise<Account>;
  readonly busy: boolean;
  readonly onDone: (account: Account) => void;
}

export function SignupForm({ signUp, busy, onDone }: SignupFormProps) {
  const phone = usePhoneInput();
  const [data, setData] = useState<Omit<SignupData, "phone">>({
    password: "",
    displayName: "",
    email: "",
    acceptsTerms: false,
  });
  const [error, setError] = useState<string | null>(null);
  const set =
    <K extends keyof typeof data>(key: K) =>
    (value: (typeof data)[K]) => {
      setData((current) => ({ ...current, [key]: value }));
    };

  const submit = () => {
    setError(null);
    const e164 = phone.submitValue();
    if (e164 === null) return;
    signUp({ ...data, phone: e164 }).then(onDone, (reason: unknown) => {
      setError(reasonOf(reason));
    });
  };

  return (
    <Form onSubmit={submit} error={error}>
      <TextField
        label="Nome social"
        value={data.displayName}
        onChange={set("displayName")}
        autoComplete="name"
        placeholder="Como quer ser chamado"
        hint="É o único nome que aparece no mural."
        required
      />
      <PhoneField
        {...phone.field}
        label="Celular com WhatsApp"
        hint="É o celular que vai receber as mensagens no WhatsApp."
      />
      <TextField
        label="E-mail"
        optional
        value={data.email}
        onChange={set("email")}
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="voce@exemplo.com"
        hint="Só para recuperar a senha."
      />
      <PasswordField
        value={data.password}
        onChange={set("password")}
        autoComplete="new-password"
        placeholder="Crie uma senha"
        hint="Pelo menos 8 caracteres."
      />
      <CheckboxField checked={data.acceptsTerms} onChange={set("acceptsTerms")}>
        Li e aceito os termos de uso e a política de privacidade.
      </CheckboxField>
      <ActionButton submit emphasis="primary" busy={busy} disabled={!data.acceptsTerms}>
        Criar conta
      </ActionButton>
    </Form>
  );
}
