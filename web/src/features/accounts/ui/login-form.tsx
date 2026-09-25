import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { usePhoneInput } from "@/shared/app/use-phone-input";
import { ActionButton } from "@/shared/ui/action-button";
import { Form } from "@/shared/ui/form";
import { inlineLinkClass } from "@/shared/ui/link-class";
import { PasswordField } from "@/shared/ui/password-field";
import { PhoneField } from "@/shared/ui/phone-field";

import type { Account, LoginData } from "../domain/account";
import { reasonOf } from "./reason";

interface LoginFormProps {
  readonly logIn: (data: LoginData) => Promise<Account>;
  readonly busy: boolean;
  readonly onDone: (account: Account) => void;
}

export function LoginForm({ logIn, busy, onDone }: LoginFormProps) {
  const phone = usePhoneInput();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    setError(null);
    const e164 = phone.submitValue();
    if (e164 === null) return;
    logIn({ phone: e164, password }).then(onDone, (reason: unknown) => {
      setError(reasonOf(reason));
    });
  };

  return (
    <Form onSubmit={submit} error={error}>
      <PhoneField {...phone.field} label="Celular" />
      <PasswordField
        value={password}
        onChange={setPassword}
        autoComplete="current-password"
        placeholder="Sua senha"
        labelAside={
          <Link to="/esqueci-senha" className={`${inlineLinkClass} text-sm`}>
            Esqueci a senha
          </Link>
        }
      />
      <ActionButton submit emphasis="primary" busy={busy}>
        Entrar
      </ActionButton>
    </Form>
  );
}
