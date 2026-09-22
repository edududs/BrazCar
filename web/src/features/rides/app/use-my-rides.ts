import { useQuery } from "@tanstack/react-query";

import { fetchMyRides } from "../adapters/rides-gateway";
import type { BoardStatus } from "../domain/board";
import type { Ride } from "../domain/ride";
import { rideKeys } from "./keys";

export interface MyRides {
  readonly rides: readonly Ride[];
  readonly status: BoardStatus;
}

/** The driver's own rides, every status, latest departure first. Needs a session. */
export function useMyRides(): MyRides {
  const { data, status } = useQuery({
    queryKey: rideKeys.mine,
    queryFn: ({ signal }) => fetchMyRides(signal),
    retry: false,
  });
  return {
    rides: data ?? [],
    status: status === "pending" ? "loading" : status === "success" ? "ready" : "failed",
  };
}
