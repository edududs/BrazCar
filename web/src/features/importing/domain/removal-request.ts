/** Contracts of the public removal request (D-162, D-172). The API shape stays in adapters/. */

/** The longest note the API takes for a removal request; the field counts against it. */
export const REMOVAL_NOTE_LIMIT = 500;

export interface RemovalRequestData {
  /** E.164, whatever the phone: the API answers 202 the same, whether it has rides or not. */
  readonly phone: string;
  /** `null` for no explanation; the field trims what is typed before sending it. */
  readonly note: string | null;
}

/** What the API refused, in words the screen can show. */
export class RemovalRequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "RemovalRequestError";
  }
}
