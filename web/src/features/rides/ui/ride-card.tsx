import { Link } from "@tanstack/react-router";

import { PersonalData } from "@/features/accounts/ui/personal-data";
import { Avatar } from "@/shared/ui/avatar";
import { Badge } from "@/shared/ui/badge";
import { Icon } from "@/shared/ui/icon";

import type { Ride, Stop } from "../domain/ride";
import { formatDayChip, formatPriceShort, formatTime } from "./format";
import { RouteLine } from "./route-line";
import { SeatPips } from "./seat-pips";
import { StatusBadge } from "./status-badge";

interface RideCardProps {
  readonly ride: Ride;
  /** On a list that spans days, the day sits beside the time. */
  readonly showDay?: boolean;
  /** Just arrived through the signal: the "Nova" badge and a brand ring (S02). */
  readonly fresh?: boolean;
  /** Stops that answered the search, marked in brand (S02). */
  readonly matched?: ((stop: Stop) => boolean) | undefined;
}

/**
 * One ride on a list, answering in this order: when it leaves, where it passes, how much, how
 * many seats, with whom (S01). "Aberta" is the normal state and wears no badge (F6).
 */
export function RideCard({ ride, showDay = false, fresh = false, matched }: RideCardProps) {
  const gone = ride.status === "cancelled" || ride.status === "departed";
  const cancelled = ride.status === "cancelled";
  return (
    <Link
      to="/caronas/$rideId"
      params={{ rideId: ride.id }}
      className={`flex flex-col gap-3 rounded-card border border-line-soft bg-surface px-4 pt-4 pb-3.5 shadow-1 transition-transform duration-(--duration-press) ease-out active:scale-[.985] ${gone ? "text-ink-3" : "text-ink"} ${fresh ? "animate-ride-in ring-2 ring-brand shadow-2" : ""}`}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          style={{ viewTransitionName: `ride-time-${ride.id}` }}
          className={`font-display text-time font-bold tabular-nums ${cancelled ? "line-through decoration-2" : ""}`}
        >
          {formatTime(ride.departureAt)}
        </span>
        {showDay ? (
          <span className="text-sm font-semibold whitespace-nowrap text-ink-3">
            {formatDayChip(ride.departureAt)}
          </span>
        ) : null}
        {ride.status === "open" ? null : <StatusBadge status={ride.status} />}
        {fresh ? <Badge tone="accent">Nova</Badge> : null}
        <span className="ml-auto text-right text-body font-bold whitespace-nowrap tabular-nums">
          {ride.hasFares ? (
            <small className="block text-label leading-none font-semibold text-ink-3">
              a partir de
            </small>
          ) : null}
          {formatPriceShort(ride.price)}
        </span>
      </div>
      <RouteLine stops={ride.stops} matched={matched} />
      {ride.notes === null ? null : (
        <p className="-mt-0.5 truncate text-sm text-ink-2">“{ride.notes}”</p>
      )}
      {gone ? null : (
        <div className="flex min-w-0 items-center gap-2.5 border-t border-line-soft pt-3 text-sm text-ink-2">
          {ride.isMine ? (
            <span className="text-ink-3">
              <Icon name="route" size={16} />
            </span>
          ) : (
            <PersonalData fallback="line">
              {ride.driverName === null ? null : <Avatar name={ride.driverName} />}
            </PersonalData>
          )}
          <PersonalData fallback="line">
            <span className="min-w-0 flex-1 truncate">
              {ride.isMine || ride.driverName === null ? null : (
                <b className="font-semibold text-ink">{ride.driverName}</b>
              )}
              {ride.car === null
                ? null
                : `${ride.isMine || ride.driverName === null ? "" : " · "}${ride.car.model} ${ride.car.color}`}
            </span>
          </PersonalData>
          {ride.isMine ? <Badge tone="accent">Sua carona</Badge> : null}
          {ride.origin === "whatsapp" ? (
            <Badge tone="outline" icon={<Icon name="chat" size={16} />}>
              via WhatsApp
            </Badge>
          ) : null}
          <SeatPips available={ride.seatsAvailable} wordy={ride.origin !== "whatsapp"} />
        </div>
      )}
    </Link>
  );
}
