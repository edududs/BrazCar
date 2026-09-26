import { useState } from "react";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { confirmEmail, requestEmailChange } from "../adapters/accounts-gateway";
import type { Account } from "../domain/account";
import { SESSION_KEY } from "./use-session";

/**
 * Headless: the e-mail step of a held account (D-168), and the e-mail link's own confirmation.
 * The request/resend/another-address dance is the same shape `useInvite` drives (codex-engenharia:
 * one shape, not two copies) — what differs is that a change has no server-side "awaiting
 * confirmation" to resume on a reload, so the form always starts blank instead.
 */
export type EmailConfirmationView =
  | {
      readonly status: "form";
      readonly sending: boolean;
      readonly requestLink: (email: string) => Promise<void>;
    }
  | {
      readonly status: "sent";
      /** The address typed this session: this flow never resumes from a mask (D-168). */
      readonly email: string;
      readonly sending: boolean;
      readonly resend: () => Promise<void>;
      readonly useAnotherEmail: () => void;
    };

export interface EmailConfirmationActions {
  readonly view: EmailConfirmationView;
  /** Opens the e-mail's own link: confirms the token and updates the session with the account it
   * returns (D-168). */
  readonly confirm: (token: string) => Promise<Account>;
  readonly confirming: boolean;
}

export function useEmailConfirmation(): EmailConfirmationActions {
  const queryClient = useQueryClient();
  const [typedEmail, setTypedEmail] = useState<string | null>(null);

  const sendMutation = useMutation({
    mutationFn: (email: string) => requestEmailChange(email),
    onSuccess: (_done, email) => {
      setTypedEmail(email);
    },
  });
  const confirmMutation = useMutation({
    mutationFn: confirmEmail,
    onSuccess: (account) => {
      queryClient.setQueryData(SESSION_KEY, account);
    },
  });

  const requestLink = (email: string) => sendMutation.mutateAsync(email);
  const resend = () =>
    typedEmail === null
      ? Promise.reject(new Error("Sem e-mail para reenviar."))
      : sendMutation.mutateAsync(typedEmail);
  const useAnotherEmail = () => {
    setTypedEmail(null);
  };

  const view: EmailConfirmationView =
    typedEmail === null
      ? { status: "form", sending: sendMutation.isPending, requestLink }
      : {
          status: "sent",
          email: typedEmail,
          sending: sendMutation.isPending,
          resend,
          useAnotherEmail,
        };

  return { view, confirm: confirmMutation.mutateAsync, confirming: confirmMutation.isPending };
}
