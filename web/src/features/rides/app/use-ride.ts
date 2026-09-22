import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  cancelRide,
  changeSeats,
  editRide,
  fetchRide,
  repeatRide,
} from "../adapters/rides-gateway";
import type { Ride, RideChanges } from "../domain/ride";
import { rideKeys } from "./keys";

export type RideStatusView = "loading" | "ready" | "missing" | "failed";

/** Headless single ride: what the API says about it, and every change the driver may make. */
export interface RideActions {
  readonly ride: Ride | null;
  readonly status: RideStatusView;
  readonly changeSeats: (seatsAvailable: number) => Promise<Ride>;
  readonly edit: (changes: RideChanges) => Promise<Ride>;
  readonly cancel: () => Promise<Ride>;
  /** A new ride; the caller navigates to it. */
  readonly repeat: (departureAt: string) => Promise<Ride>;
  readonly busy: boolean;
}

export function useRide(rideId: string): RideActions {
  const queryClient = useQueryClient();
  const { data, status, error } = useQuery({
    queryKey: rideKeys.one(rideId),
    queryFn: ({ signal }) => fetchRide(rideId, signal),
    retry: false,
  });

  const remember = (ride: Ride) => {
    queryClient.setQueryData(rideKeys.one(ride.id), ride);
    void queryClient.invalidateQueries({ queryKey: rideKeys.boards });
    void queryClient.invalidateQueries({ queryKey: rideKeys.mine });
  };
  const seatsMutation = useMutation({
    mutationFn: (seatsAvailable: number) => changeSeats(rideId, seatsAvailable),
    onSuccess: remember,
  });
  const editMutation = useMutation({
    mutationFn: (changes: RideChanges) => editRide(rideId, changes),
    onSuccess: remember,
  });
  const cancelMutation = useMutation({ mutationFn: () => cancelRide(rideId), onSuccess: remember });
  const repeatMutation = useMutation({
    mutationFn: (departureAt: string) => repeatRide(rideId, departureAt),
    onSuccess: remember,
  });

  const missing =
    status === "error" && typeof error === "object" && "status" in error && error.status === 404;

  return {
    ride: data ?? null,
    status:
      status === "pending"
        ? "loading"
        : status === "success"
          ? "ready"
          : missing
            ? "missing"
            : "failed",
    changeSeats: seatsMutation.mutateAsync,
    edit: editMutation.mutateAsync,
    cancel: cancelMutation.mutateAsync,
    repeat: repeatMutation.mutateAsync,
    busy: [seatsMutation, editMutation, cancelMutation, repeatMutation].some((m) => m.isPending),
  };
}
