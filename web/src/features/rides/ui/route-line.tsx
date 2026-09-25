import type { Stop } from "../domain/ride";
import { formatPrice } from "./format";

interface RouteLineProps {
  readonly stops: readonly Stop[];
  /** Stops that answered the search, marked so the person sees why the ride is here (S02). */
  readonly matched?: ((stop: Stop) => boolean) | undefined;
}

/**
 * The route as a line with stops, in one flowing row: the origin in ink, the destination in
 * brand, the stops between in a lighter weight. Long routes wrap; nothing is cut (S01).
 */
export function RouteLine({ stops, matched = () => false }: RouteLineProps) {
  const last = stops.length - 1;
  return (
    <p className="flex min-w-0 flex-wrap items-center gap-y-1 text-body leading-[1.3] font-semibold">
      {stops.map((stop, index) => {
        const role = index === 0 ? "origin" : index === last ? "destination" : "via";
        return (
          <span
            key={`${String(index)}-${stop.label}`}
            className={`inline-flex items-center gap-[7px] ${role === "via" ? "font-medium text-ink-2" : ""}`}
          >
            <Dot role={role} />
            {matched(stop) ? (
              <mark className="rounded-[5px] bg-brand-soft px-1 font-semibold text-brand-ink">
                {stop.label}
              </mark>
            ) : (
              stop.label
            )}
            {index === last ? null : (
              <span aria-hidden className="mx-1.5 h-0.5 w-3.5 shrink-0 rounded-sm bg-line-strong" />
            )}
          </span>
        );
      })}
    </p>
  );
}

function Dot({ role }: { readonly role: "origin" | "via" | "destination" }) {
  const look =
    role === "origin"
      ? "border-ink bg-ink"
      : role === "destination"
        ? "border-brand bg-brand"
        : "border-ink-3 bg-surface";
  return <span aria-hidden className={`size-2 shrink-0 rounded-full border-2 ${look}`} />;
}

/** The same route, vertical, with the fare beside each priced stop (S03). */
export function RouteList({ stops, matched = () => false }: RouteLineProps) {
  const last = stops.length - 1;
  return (
    <ol className="flex flex-col">
      {stops.map((stop, index) => {
        const role = index === 0 ? "origin" : index === last ? "destination" : "via";
        return (
          <li
            key={`${String(index)}-${stop.label}`}
            className="relative grid min-h-[54px] grid-cols-[20px_minmax(0,1fr)_auto] items-center gap-x-3"
          >
            <span
              aria-hidden
              className={`absolute left-[9px] w-0.5 bg-line-strong ${index === 0 ? "top-1/2" : "top-0"} ${index === last ? "bottom-1/2" : "bottom-0"}`}
            />
            <span
              aria-hidden
              className={`z-[1] justify-self-center rounded-full border-[2.5px] ${
                role === "origin"
                  ? "size-3 border-ink bg-ink"
                  : role === "destination"
                    ? "size-[15px] border-brand bg-brand"
                    : `size-3 bg-surface ${matched(stop) ? "border-brand ring-4 ring-ring" : "border-ink-3"}`
              }`}
            />
            <span className="flex flex-col py-2 text-body leading-[1.25] font-semibold">
              {role === "via" ? null : (
                <small className="text-caption font-medium text-ink-3">
                  {role === "origin" ? "Sai de" : "Vai para"}
                </small>
              )}
              {stop.label}
            </span>
            {stop.fare === null ? (
              <span />
            ) : (
              <span className="text-base font-bold tabular-nums">{formatPrice(stop.fare)}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
