import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { ActionButton } from "@/shared/ui/action-button";
import { Form } from "@/shared/ui/form";
import { Icon } from "@/shared/ui/icon";
import { ListGroup, ListRowButton } from "@/shared/ui/list-row";
import { NoticeBar } from "@/shared/ui/notice-bar";
import { NoticeScreen } from "@/shared/ui/notice-screen";
import { TextField } from "@/shared/ui/text-field";

import type { EmailConfirmationView } from "../app/use-email-confirmation";
import type { Account } from "../domain/account";
import { DeleteAccountDialog } from "./delete-account-dialog";
import { InviteSentScreen } from "./invite-sent-screen";
import { reasonOf } from "./reason";

interface HeldAccountScreenProps {
  readonly account: Account;
  readonly view: EmailConfirmationView;
  /** Any of `useSession`'s mutations in flight: disables sign-out and delete the same way the
   * working account's panel does. */
  readonly busy: boolean;
  readonly logOut: () => Promise<void>;
  readonly deleteAccount: () => Promise<void>;
}

/**
 * What a held account sees instead of anything it cannot do yet (D-168): why it is held, the
 * e-mail step, then the ways out that stay open regardless — the mural, signing out, deleting.
 * Once the link is sent, this reuses `InviteSentScreen`: the wait is the same screen either way,
 * as the invite's own step already treats it (D-166).
 */
export function HeldAccountScreen({
  account,
  view,
  busy,
  logOut,
  deleteAccount,
}: HeldAccountScreenProps) {
  const [error, setError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const fail = (reason: unknown) => {
    setError(reasonOf(reason));
  };

  const waysOut = (
    <div className="flex flex-col gap-3">
      <Link to="/" className="text-center text-secondary font-semibold text-brand-ink">
        Ver o mural
      </Link>
      {error === null ? null : (
        <NoticeBar tone="critical" role="alert">
          {error}
        </NoticeBar>
      )}
      <ListGroup>
        <ListRowButton
          icon={<Icon name="logout" />}
          title="Sair da conta"
          disabled={busy}
          onPress={() => {
            logOut().catch(fail);
          }}
        />
        <ListRowButton
          icon={<Icon name="trash" />}
          title="Excluir conta"
          tone="critical"
          disabled={busy}
          onPress={() => {
            setDeleteOpen(true);
          }}
        />
      </ListGroup>
      <DeleteAccountDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        phoneDisplay={account.phoneDisplay}
        busy={busy}
        onConfirm={() => {
          setDeleteOpen(false);
          deleteAccount().catch(fail);
        }}
      />
    </div>
  );

  if (view.status === "sent") {
    return (
      <div className="flex flex-col gap-6">
        <InviteSentScreen
          email={view.email}
          canResend
          sending={view.sending}
          resend={view.resend}
          useAnotherEmail={view.useAnotherEmail}
        />
        {waysOut}
      </div>
    );
  }

  return (
    <NoticeScreen
      title="Falta confirmar seu e-mail"
      glyph={<Icon name="mail" size={32} />}
      glyphTone="brand"
      action={
        <div className="flex flex-col gap-5">
          <EmailStep
            initialEmail={account.email ?? ""}
            sending={view.sending}
            requestLink={view.requestLink}
          />
          {waysOut}
        </div>
      }
    >
      Para publicar, pedir contato e editar, sua conta precisa de um e-mail confirmado: é por ele
      que você recupera a senha.
    </NoticeScreen>
  );
}

interface EmailStepProps {
  /** The account's own address, when it already has one nobody confirmed yet. */
  readonly initialEmail: string;
  readonly sending: boolean;
  readonly requestLink: (email: string) => Promise<void>;
}

/** The one field that starts the e-mail step, pre-filled when the account already has an
 * unconfirmed address (D-168). */
function EmailStep({ initialEmail, sending, requestLink }: EmailStepProps) {
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    setError(null);
    requestLink(email).catch((reason: unknown) => {
      setError(reasonOf(reason));
    });
  };

  return (
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
  );
}
