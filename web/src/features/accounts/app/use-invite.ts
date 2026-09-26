import { useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { giveInviteEmail, openInvite } from "../adapters/accounts-gateway";
import { AccountRequestError, type Invite } from "../domain/account";

/**
 * Headless: opens the invite by its token (D-166, D-167) and drives the e-mail step. The status
 * says what the screen can draw, and each variant carries only what that screen needs — there is
 * no "open" without an invite, and no "sent" without an address to show (codex-engenharia).
 */
export type InviteView =
  | { readonly status: "loading" }
  | { readonly status: "refused"; readonly reason: string | null }
  | {
      readonly status: "open";
      readonly invite: Invite;
      readonly sending: boolean;
      readonly giveEmail: (email: string) => Promise<void>;
    }
  | {
      readonly status: "sent";
      /** The address to show: typed this session, or the API's own mask. */
      readonly email: string;
      /** `false` when only the mask is known (a reload caught an invite already awaiting one),
       * so "Reenviar" has no address to send again with — only "usar outro e-mail" moves on. */
      readonly canResend: boolean;
      readonly sending: boolean;
      readonly resend: () => Promise<void>;
      readonly useAnotherEmail: () => void;
    };

export function useInvite(token: string): InviteView {
  const queryClient = useQueryClient();
  const queryKey = ["invite", token] as const;
  const { data, status, error } = useQuery({
    queryKey,
    queryFn: ({ signal }) => openInvite(token, signal),
    enabled: token !== "",
    retry: false,
  });

  // The address typed this session: kept only to resend it and to show it in place of the API's
  // mask. Redigitar ("usar outro e-mail") sends the person back to the form; the previous link
  // dies the moment a new one is asked for (D-166), so nothing here needs to cancel it.
  const [typedEmail, setTypedEmail] = useState<string | null>(null);
  const [atForm, setAtForm] = useState(false);

  const mutation = useMutation({
    mutationFn: (email: string) => giveInviteEmail(token, email),
    onSuccess: (_done, email) => {
      setTypedEmail(email);
      setAtForm(false);
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  const giveEmail = (email: string) => mutation.mutateAsync(email);
  const resend = () =>
    typedEmail === null
      ? Promise.reject(new Error("Sem e-mail para reenviar."))
      : mutation.mutateAsync(typedEmail);
  const useAnotherEmail = () => {
    setAtForm(true);
  };

  if (token === "") return { status: "refused", reason: null };
  if (status === "pending") return { status: "loading" };
  if (data === undefined) {
    return {
      status: "refused",
      reason: error instanceof AccountRequestError ? error.message : null,
    };
  }

  const sent = !atForm && (typedEmail !== null || data.status === "awaiting_email_confirmation");
  if (sent) {
    return {
      status: "sent",
      email: typedEmail ?? data.emailMasked ?? "",
      canResend: typedEmail !== null,
      sending: mutation.isPending,
      resend,
      useAnotherEmail,
    };
  }
  return { status: "open", invite: data, sending: mutation.isPending, giveEmail };
}
