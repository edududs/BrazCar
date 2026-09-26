import type { RequiredAction } from "@/shared/domain/account-held";

export type { RequiredAction };

export interface Car {
  readonly id: string;
  readonly model: string;
  readonly color: string;
  readonly plate: string;
}

/** The signed-in person's own account. Nobody else's account ever reaches the front. */
export interface Account {
  readonly id: string;
  /** E.164, `+5561999990001`. */
  readonly phone: string;
  /** Ready to show, `(61) 99999-0001` (D-137). */
  readonly phoneDisplay: string;
  readonly displayName: string;
  readonly email: string | null;
  readonly emailConfirmed: boolean;
  /** Calculated, never stored: what the account must do before it can write (D-168). */
  readonly requiredAction: RequiredAction | null;
  readonly cars: readonly Car[];
  readonly canDrive: boolean;
}

/** The invite's own situation, calculated by the API, never guessed by the front (D-166). */
export type InviteStatus = "open" | "awaiting_email_confirmation";

/** The invite's page (D-166, D-167): phone and e-mail come masked, so a forwarded link reveals
 * only that. */
export interface Invite {
  readonly status: InviteStatus;
  /** `+5561*****0001`. */
  readonly phoneMasked: string;
  /** Set once an e-mail was given and awaits its own confirmation link. */
  readonly emailMasked: string | null;
  readonly expiresAt: string;
}

/** The e-mail link's page, telephone and e-mail already fixed by the invite (D-167). */
export interface OpenSignup {
  /** `+5561*****0001`, the invite's own mask. */
  readonly phoneMasked: string;
  readonly email: string;
  readonly emailExpiresAt: string;
}

/** `POST /accounts/register`: the invite's e-mail link finishes the account (D-167). */
export interface SignupData {
  readonly emailToken: string;
  readonly password: string;
  readonly displayName: string;
  readonly acceptsTerms: boolean;
}

export interface LoginData {
  readonly phone: string;
  readonly password: string;
}

export interface CarData {
  readonly model: string;
  readonly color: string;
  readonly plate: string;
}

/** What `PATCH /accounts/me` changes: the display name only (D-168). Absent means unchanged. */
export interface ProfileChanges {
  readonly displayName?: string;
}

export interface ChangePasswordData {
  readonly currentPassword: string;
  readonly newPassword: string;
}

/** What the API refused, in words the screen can show. */
export class AccountRequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "AccountRequestError";
  }
}
