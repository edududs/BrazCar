import { useState } from "react";

import { ActionButton } from "@/shared/ui/action-button";
import { Form } from "@/shared/ui/form";
import { TextField } from "@/shared/ui/text-field";

import type { Account, LoginData } from "../domain/account";
import { reasonOf } from "./reason";

interface LoginFormProps {
  readonly logIn: (data: LoginData) => Promise<Account>;
  readonly busy: boolean;
  readonly onDone: (account: Account) => void;
}

export function LoginForm({ logIn, busy, onDone }: LoginFormProps) {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    setError(null);
    logIn({ phone, password }).then(onDone, (reason: unknown) => {
      setError(reasonOf(reason));
    });
  };

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
        required
      />
      <TextField
        label="Senha"
        value={password}
        onChange={setPassword}
        type="password"
        autoComplete="current-password"
        required
      />
      <ActionButton submit emphasis="primary" disabled={busy}>
        Entrar
      </ActionButton>
    </Form>
  );
}
