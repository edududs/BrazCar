import type { Account } from "../domain/account";

/** Where to go once signed in: either back to a validated `returnTo`, or one of the app's own
 * routes — kept as a literal union so the caller still navigates by `to`, typed, in that case. */
export type SignInLanding =
  | { readonly kind: "return"; readonly href: string }
  | { readonly kind: "route"; readonly to: "/" | "/conta" };

/**
 * Where signing in leads (product decision, D-168): a valid `returnTo` always wins, because the
 * e-mail link's page needs to come back to `/confirmar-email` and nowhere else says so. Without
 * one, a held account goes straight to `/conta` — the only screen it can act on until it confirms
 * an e-mail — and everyone else to the board.
 */
export function landingAfterSignIn(account: Account, returnTo: string | null): SignInLanding {
  if (returnTo !== null) return { kind: "return", href: returnTo };
  return { kind: "route", to: account.requiredAction === null ? "/" : "/conta" };
}
