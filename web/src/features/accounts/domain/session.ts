import type { Account } from "./account";

export type Session =
  | { readonly status: "checking" }
  | { readonly status: "anonymous" }
  | { readonly status: "signed-in"; readonly account: Account };
