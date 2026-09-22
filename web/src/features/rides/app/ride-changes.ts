import type { Ride, RideChanges, RideDraft, StopDraft } from "../domain/ride";

function sameStops(a: readonly StopDraft[], b: readonly StopDraft[]): boolean {
  if (a.length !== b.length) return false;
  for (const [i, stop] of a.entries()) {
    const other = b[i];
    if (other?.placeId !== stop.placeId || other.text !== stop.text) return false;
  }
  return true;
}

/** What the driver's draft changes on the ride: only that is sent, so an untouched form edits nothing. */
export function changesBetween(ride: Ride, draft: RideDraft): RideChanges {
  const before: StopDraft[] = ride.stops.map((stop) =>
    stop.placeId === null
      ? { placeId: null, text: stop.label }
      : { placeId: stop.placeId, text: "" },
  );
  const changes: {
    stops?: readonly StopDraft[];
    departureAt?: string;
    price?: string;
    paymentMethods?: readonly ("cash" | "pix")[];
  } = {};
  if (!sameStops(before, draft.stops)) changes.stops = draft.stops;
  if (new Date(draft.departureAt).getTime() !== new Date(ride.departureAt).getTime()) {
    changes.departureAt = draft.departureAt;
  }
  if (Number(draft.price) !== Number(ride.price)) changes.price = draft.price;
  const methods = [...draft.paymentMethods].sort().join();
  if (methods !== [...ride.paymentMethods].sort().join())
    changes.paymentMethods = draft.paymentMethods;
  return changes;
}

/** The form's starting point for editing `ride`. The car is a snapshot and does not change (D-023). */
export function draftOf(ride: Ride): RideDraft {
  return {
    carId: "",
    stops: ride.stops.map((stop) =>
      stop.placeId === null
        ? { placeId: null, text: stop.label }
        : { placeId: stop.placeId, text: "" },
    ),
    departureAt: ride.departureAt,
    seatsAvailable: ride.seatsAvailable,
    price: ride.price,
    paymentMethods: ride.paymentMethods,
  };
}
