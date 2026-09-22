/** Contracts of the rides feature, as the screens need them. The API shape stays in adapters/. */

export type RideStatus = "open" | "reopened" | "full" | "departed" | "cancelled";

export type PaymentMethod = "cash" | "pix";

export interface Stop {
  /** `null` for a free-text stop ("other", D-013). */
  readonly placeId: string | null;
  readonly label: string;
}

/** What the viewer may do, decided by the API (ADR-0011). The screens only draw these. */
export interface RideActions {
  readonly canEdit: boolean;
  readonly canChangeSeats: boolean;
  readonly canCancel: boolean;
  readonly canRepeat: boolean;
  readonly canContact: boolean;
  /** ISO instant: the latest departure an edit may set now, when editing after leaving. */
  readonly delayUntil: string | null;
}

/** A card of the board. Never the phone, never the plate (ADR-0006). */
export interface Ride {
  readonly id: string;
  readonly driverName: string;
  readonly carModel: string;
  readonly carColor: string;
  readonly stops: readonly Stop[];
  /** ISO instant with offset. */
  readonly departureAt: string;
  readonly seatsAvailable: number;
  /** Decimal as text, "7.00": money never goes through a float. */
  readonly price: string;
  readonly paymentMethods: readonly PaymentMethod[];
  readonly status: RideStatus;
  readonly actions: RideActions;
  readonly isMine: boolean;
}

/** One stop as the driver fills it in: a catalog place, or text for "other". Exactly one is set. */
export interface StopDraft {
  readonly placeId: string | null;
  readonly text: string;
}

export interface RideDraft {
  readonly carId: string;
  readonly stops: readonly StopDraft[];
  /** ISO instant. */
  readonly departureAt: string;
  readonly seatsAvailable: number;
  readonly price: string;
  readonly paymentMethods: readonly PaymentMethod[];
}

/** What an edit changes. Absent means unchanged. */
export interface RideChanges {
  readonly stops?: readonly StopDraft[];
  readonly departureAt?: string;
  readonly price?: string;
  readonly paymentMethods?: readonly PaymentMethod[];
}

/** The only way the phone and the plate reach the screen (ADR-0006). */
export interface Contact {
  readonly whatsappUrl: string;
  readonly plate: string;
}

/** What the API refused, in words the screen can show. */
export class RideRequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "RideRequestError";
  }
}
