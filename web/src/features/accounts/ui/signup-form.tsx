import { useState } from "react";

import type { LegalDocumentKind } from "@/shared/domain/legal-documents";
import { ActionButton } from "@/shared/ui/action-button";
import { CheckboxField } from "@/shared/ui/checkbox-field";
import { Form } from "@/shared/ui/form";
import { InlineButton } from "@/shared/ui/inline-button";
import { PasswordField } from "@/shared/ui/password-field";
import { TextField } from "@/shared/ui/text-field";

import type { Account, OpenSignup, SignupData } from "../domain/account";
import { LegalSheet } from "./legal-sheet";
import { reasonOf } from "./reason";

export type RegisterInput = Omit<SignupData, "emailToken">;

interface SignupFormProps {
  /** What the invite's e-mail link fixed: the phone masked, the e-mail in the clear (D-167). */
  readonly signup: OpenSignup;
  readonly signUp: (data: RegisterInput) => Promise<Account>;
  readonly busy: boolean;
  readonly onDone: (account: Account) => void;
}

/** Three fields and the terms; the phone and the e-mail are shown, never typed (D-167). */
export function SignupForm({ signup, signUp, busy, onDone }: SignupFormProps) {
  const [data, setData] = useState<RegisterInput>({
    displayName: "",
    password: "",
    acceptsTerms: false,
  });
  const [error, setError] = useState<string | null>(null);
  // The kind outlives the closing, so the text does not vanish while the sheet slides away.
  const [sheet, setSheet] = useState<{ kind: LegalDocumentKind; open: boolean }>({
    kind: "terms",
    open: false,
  });
  const read = (kind: LegalDocumentKind) => {
    setSheet({ kind, open: true });
  };
  const set =
    <K extends keyof RegisterInput>(key: K) =>
    (value: RegisterInput[K]) => {
      setData((current) => ({ ...current, [key]: value }));
    };

  const submit = () => {
    setError(null);
    signUp(data).then(onDone, (reason: unknown) => {
      setError(reasonOf(reason));
    });
  };

  return (
    <>
      <Form onSubmit={submit} error={error}>
        <TextField label="Celular" value={signup.phoneMasked} onChange={() => undefined} readOnly />
        <TextField label="E-mail" value={signup.email} onChange={() => undefined} readOnly />
        <TextField
          label="Nome social"
          value={data.displayName}
          onChange={set("displayName")}
          autoComplete="name"
          placeholder="Como quer ser chamado"
          hint="É o único nome que aparece no mural."
          required
        />
        <PasswordField
          value={data.password}
          onChange={set("password")}
          autoComplete="new-password"
          placeholder="Crie uma senha"
          hint="Pelo menos 8 caracteres."
        />
        <CheckboxField checked={data.acceptsTerms} onChange={set("acceptsTerms")}>
          Li e aceito os{" "}
          <InlineButton
            onPress={() => {
              read("terms");
            }}
          >
            termos de uso
          </InlineButton>{" "}
          e a{" "}
          <InlineButton
            onPress={() => {
              read("privacy");
            }}
          >
            política de privacidade
          </InlineButton>
          .
        </CheckboxField>
        <ActionButton submit emphasis="primary" busy={busy} disabled={!data.acceptsTerms}>
          Criar conta
        </ActionButton>
      </Form>
      <LegalSheet
        kind={sheet.kind}
        open={sheet.open}
        onOpenChange={(open) => {
          setSheet((current) => ({ ...current, open }));
        }}
        onAccept={() => {
          set("acceptsTerms")(true);
          setSheet((current) => ({ ...current, open: false }));
        }}
      />
    </>
  );
}
