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
  readonly cars: readonly Car[];
  readonly canDrive: boolean;
}

export interface SignupData {
  readonly phone: string;
  readonly password: string;
  readonly displayName: string;
  readonly email: string;
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
