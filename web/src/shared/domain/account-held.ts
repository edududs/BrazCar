/** What an account owes before it can write anything else (D-168). Only one exists today. */
export type RequiredAction = "confirm_email";

/**
 * A write the API refused because the account is still held (D-168): every gated route answers
 * with the same shape (`HeldOut`, a 403 naming the action owed), so every gateway recognizes it
 * the same way, in one place, instead of each screen parsing a refusal's body on its own.
 */
export class AccountHeldError extends Error {
  constructor(
    readonly action: RequiredAction,
    message = "Confirme seu e-mail para continuar.",
  ) {
    super(message);
    this.name = "AccountHeldError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** `null` unless `status`/`body` is the API's `HeldOut` shape: a 403 naming the action owed. */
export function heldErrorOf(status: number, body: unknown): AccountHeldError | null {
  if (status !== 403 || !isRecord(body)) return null;
  const { required_action: action, detail } = body;
  if (action !== "confirm_email") return null;
  return new AccountHeldError(action, typeof detail === "string" ? detail : undefined);
}
