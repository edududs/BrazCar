/**
 * Moments counted from the seed's anchor, in the board's zone (D-094).
 *
 * The browser runs in `America/Sao_Paulo` by configuration, but the process that writes these
 * strings may not, so the zone is named here instead of trusting the machine.
 */

const zone = "America/Sao_Paulo";

const localParts = new Intl.DateTimeFormat("sv-SE", {
  timeZone: zone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const clockParts = new Intl.DateTimeFormat("sv-SE", {
  timeZone: zone,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function shifted(anchor: string, minutes: number): Date {
  return new Date(new Date(anchor).getTime() + minutes * 60_000);
}

/** What a `datetime-local` field expects: `2026-09-25T07:30`, in the board's zone. */
export function localInput(anchor: string, minutes: number): string {
  return localParts.format(shifted(anchor, minutes)).replace(" ", "T");
}

/** What the API expects: an instant, with its offset. */
export function instant(anchor: string, minutes: number): string {
  return shifted(anchor, minutes).toISOString();
}

/** `HH:MM` of an instant, in the board's zone (D-141): what the "a partir de" filter compares. */
export function clockOf(instantIso: string): string {
  return clockParts.format(new Date(instantIso));
}

/** `2026-09-25`: the local day of a moment counted from the anchor, in the board's zone. */
export function localDayOf(anchor: string, minutes: number): string {
  return localInput(anchor, minutes).slice(0, 10);
}

/**
 * A moment on the same local day as `minutes`, `step` away from it: later when that stays on the
 * day, earlier otherwise. The suite runs at any hour, and a ride near midnight must not be moved
 * into the next day by a test that means "the same day".
 */
export function sameDayShift(anchor: string, minutes: number, step: number): number {
  const later = minutes + step;
  return localDayOf(anchor, later) === localDayOf(anchor, minutes) ? later : minutes - step;
}
