import { useState } from "react";

import { confirmPasswordReset, requestPasswordReset } from "../adapters/accounts-gateway";

/**
 * Headless: spends the e-mailed reset link with a new password. `busy` stays on after a success,
 * because the caller leaves the page then; it drops only when the attempt is refused.
 */
export interface PasswordResetConfirmation {
  readonly confirm: (token: string, password: string) => Promise<void>;
  readonly busy: boolean;
}

export function usePasswordResetConfirmation(): PasswordResetConfirmation {
  const [busy, setBusy] = useState(false);
  const confirm = async (token: string, password: string): Promise<void> => {
    setBusy(true);
    try {
      await confirmPasswordReset(token, password);
    } catch (reason: unknown) {
      setBusy(false);
      throw reason;
    }
  };
  return { confirm, busy };
}

export type PasswordResetRequestState = "idle" | "busy" | "sent";

/** Headless: asks for the reset link of a phone; `sent` once the API took the request. */
export interface PasswordResetRequest {
  readonly request: (phone: string) => Promise<void>;
  readonly state: PasswordResetRequestState;
}

export function usePasswordResetRequest(): PasswordResetRequest {
  const [state, setState] = useState<PasswordResetRequestState>("idle");
  const request = async (phone: string): Promise<void> => {
    setState("busy");
    try {
      await requestPasswordReset(phone);
      setState("sent");
    } catch (reason: unknown) {
      setState("idle");
      throw reason;
    }
  };
  return { request, state };
}
