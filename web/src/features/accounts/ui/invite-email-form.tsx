import { useState } from "react";

import { ActionButton } from "@/shared/ui/action-button";
import { Form } from "@/shared/ui/form";
import { TextField } from "@/shared/ui/text-field";

import type { Invite } from "../domain/account";
import { formatInviteExpiry } from "./invite-format";
import { reasonOf } from "./reason";

interface InviteEmailFormProps {
  /** The invite's own facts, phone and prazo masked for a link that can be forwarded (D-166). */
  readonly invite: Invite;
  readonly sending: boolean;
  readonly giveEmail: (email: string) => Promise<void>;
}

/** The invite's own facts, then the one field that starts the e-mail step (D-166, D-167). */
export function InviteEmailForm({ invite, sending, giveEmail }: InviteEmailFormProps) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    setError(null);
    giveEmail(email).catch((reason: unknown) => {
      setError(reasonOf(reason));
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <p className="text-body text-ink-2 text-pretty">
        Este convite é para o celular {invite.phoneMasked} e vale até{" "}
        {formatInviteExpiry(invite.expiresAt)}.
      </p>
      <Form onSubmit={submit} error={error}>
        <TextField
          label="E-mail"
          value={email}
          onChange={setEmail}
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="voce@exemplo.com"
          hint="É por ele que você recupera a senha."
          required
        />
        <ActionButton submit emphasis="primary" busy={sending}>
          Receber o link
        </ActionButton>
      </Form>
    </div>
  );
}
