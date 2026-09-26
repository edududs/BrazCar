import { useQuery } from "@tanstack/react-query";

import { openSignup } from "../adapters/accounts-gateway";
import { AccountRequestError, type OpenSignup } from "../domain/account";

export type OpenSignupStatusView = "loading" | "ready" | "refused";

/** Headless: opens the invite's e-mail link (D-167). Without a token there is nothing to ask. */
export interface OpenSignupView {
  readonly signup: OpenSignup | null;
  readonly status: OpenSignupStatusView;
  /** Why the link does not serve, in the API's own words; `null` while it might still serve. */
  readonly reason: string | null;
}

export function useOpenSignup(emailToken: string): OpenSignupView {
  const { data, status, error } = useQuery({
    queryKey: ["signup", emailToken],
    queryFn: ({ signal }) => openSignup(emailToken, signal),
    enabled: emailToken !== "",
    retry: false,
  });

  if (emailToken === "") return { signup: null, status: "refused", reason: null };
  return {
    signup: data ?? null,
    status: status === "pending" ? "loading" : status === "success" ? "ready" : "refused",
    reason: error instanceof AccountRequestError ? error.message : null,
  };
}
