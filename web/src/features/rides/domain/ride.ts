/** Contracts of the rides feature, as the screens need them. The API shape stays in adapters/. */

export type RideStatus = "open" | "reopened" | "full" | "departed" | "cancelled";

export type PaymentMethod = "cash" | "pix";

export interface Stop {
  /** `null` for a free-text stop ("other", D-013). */
  readonly placeId: string | null;
  readonly label: string;
  /** What it costs to come this far from the origin, as text; `null` when unpriced (D-131). */
  readonly fare: string | null;
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

/** Model and color only: enough to spot the car, never enough to find it (D-031). */
export interface Car {
  readonly model: string;
  readonly color: string;
}

/** Where the ride came from: published here, or read from a WhatsApp group (ADR-0015). */
export type RideOrigin = "published" | "whatsapp";

/** The original words of an imported ride, for the passenger's own judgement (D-117). */
export interface OriginMessage {
  readonly text: string;
  readonly groupLabel: string;
  /** ISO instant with offset. */
  readonly sentAt: string;
}

/** A card of the board. Never the phone, never the plate (ADR-0006). */
export interface Ride {
  readonly id: string;
  readonly driverName: string;
  /** `null` when the platform never saw the car: a ride read from WhatsApp. */
  readonly car: Car | null;
  readonly origin: RideOrigin;
  readonly originMessage: OriginMessage | null;
  readonly stops: readonly Stop[];
  /** Plain words the driver wanted said, `null` when there are none (D-129). */
  readonly notes: string | null;
  /** ISO instant with offset. */
  readonly departureAt: string;
  readonly seatsAvailable: number;
  /** Decimal as text, "7.00": money never goes through a float. */
  readonly price: string;
  /** The price is the cheapest fare, so the screen shows it as "a partir de" (D-131). */
  readonly hasFares: boolean;
  readonly paymentMethods: readonly PaymentMethod[];
  readonly status: RideStatus;
  readonly actions: RideActions;
  readonly isMine: boolean;
}

/** One stop as the driver fills it in: a catalog place, or text for "other". Exactly one is set. */
export interface StopDraft {
  readonly placeId: string | null;
  readonly text: string;
  /** Decimal as text; empty when this stop carries no fare. The first stop never has one (D-131). */
  readonly fare: string;
}

export interface RideDraft {
  readonly carId: string;
  readonly stops: readonly StopDraft[];
  /** ISO instant. */
  readonly departureAt: string;
  readonly seatsAvailable: number;
  readonly price: string;
  readonly paymentMethods: readonly PaymentMethod[];
  /** Empty means no notes; empty also erases the ones a ride had. */
  readonly notes: string;
}

/** The longest notes the API takes (D-129); the form counts against it. */
export const NOTES_LIMIT = 500;

/** What fits in a passenger car (D-142); the form and the seat stepper cap against it. */
export const MAX_SEATS = 4;

/** What an edit changes. Absent means unchanged. */
export interface RideChanges {
  readonly stops?: readonly StopDraft[];
  readonly departureAt?: string;
  readonly price?: string;
  readonly paymentMethods?: readonly PaymentMethod[];
  readonly notes?: string;
}

/** The only way the phone and the plate reach the screen (ADR-0006). */
export interface Contact {
  readonly whatsappUrl: string;
  /** Ready to show: `(61) 99999-0001`, or international for a number from abroad (D-137). */
  readonly phoneDisplay: string;
  /** `null` for a driver the platform only knows by phone. */
  readonly plate: string | null;
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
