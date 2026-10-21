/** An alert the account asked for: "tell me when a ride shows up on this day". */
export interface RideAlert {
  readonly id: string;
  readonly text: string | null;
  /** "YYYY-MM-DD", the board's day. */
  readonly day: string;
  /** "HH:MM". */
  readonly fromTime: string | null;
  /** "HH:MM". */
  readonly untilTime: string | null;
  readonly createdAt: string;
}

/** The account's alerts that have not ended, and how many it may have. */
export interface ActiveAlerts {
  readonly alerts: readonly RideAlert[];
  readonly limit: number;
}

/** What is sent to create an alert. */
export interface AlertData {
  readonly day: string;
  readonly text: string | null;
  readonly fromTime: string | null;
  readonly untilTime: string | null;
}

/** A refusal by the alerts API, in a sentence the screen can show. */
export class AlertRequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "AlertRequestError";
  }
}
