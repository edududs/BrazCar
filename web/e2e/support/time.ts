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
