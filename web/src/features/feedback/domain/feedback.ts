/** What an opinion is about, as the API names it (D-155). The words on screen live in `ui`. */
export type FeedbackKind = "suggestion" | "complaint" | "praise";

/** The longest opinion the API takes (D-155); the field counts against it. */
export const FEEDBACK_LIMIT = 1000;

export interface FeedbackData {
  readonly kind: FeedbackKind;
  readonly message: string;
  /** E.164 of whoever a complaint is about; only a complaint names someone, and only if asked. */
  readonly aboutPhone: string | null;
}

/** What the API refused, in words the screen can show. */
export class FeedbackRequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "FeedbackRequestError";
  }
}
