import { Link } from "@tanstack/react-router";

import { Card } from "@/shared/ui/card";

import type { Ride } from "../domain/ride";
import {
  formatDay,
  formatPrice,
  formatRoute,
  formatSeats,
  formatTime,
  paymentLabel,
} from "./format";
import { StatusBadge } from "./status-badge";

interface RideCardProps {
  readonly ride: Ride;
}

/** One ride on a list: the route, when, how much, who. Tapping opens the detail. */
export function RideCard({ ride }: RideCardProps) {
  const gone = ride.status === "cancelled" || ride.status === "departed";
  return (
    <Link to="/caronas/$rideId" params={{ rideId: ride.id }} className="block">
      <Card muted={gone}>
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-lg font-semibold">
            {formatTime(ride.departureAt)}{" "}
            <span className="text-sm font-normal opacity-70">{formatDay(ride.departureAt)}</span>
          </span>
          <StatusBadge status={ride.status} />
        </div>
        <p className="text-sm">{formatRoute(ride.stops)}</p>
        <p className="text-sm opacity-80">
          {formatPrice(ride.price)} · {formatSeats(ride.seatsAvailable)} ·{" "}
          {ride.paymentMethods.map((method) => paymentLabel[method]).join(" ou ")}
        </p>
        <p className="text-sm opacity-70">
          {ride.driverName} · {ride.carModel}, {ride.carColor}
          {ride.isMine ? " · sua carona" : ""}
        </p>
      </Card>
    </Link>
  );
}
