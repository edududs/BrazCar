import { useMutation, useQueryClient } from "@tanstack/react-query";

import { publishRide } from "../adapters/rides-gateway";
import type { Ride, RideDraft } from "../domain/ride";
import { rideKeys } from "./keys";

export interface Publishing {
  readonly publish: (draft: RideDraft) => Promise<Ride>;
  readonly busy: boolean;
}

/** Headless publication: sends the draft, remembers the new ride, refreshes every list. */
export function usePublishRide(): Publishing {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (draft: RideDraft) => publishRide(draft),
    onSuccess: (ride) => {
      queryClient.setQueryData(rideKeys.one(ride.id), ride);
      void queryClient.invalidateQueries({ queryKey: rideKeys.boards });
      void queryClient.invalidateQueries({ queryKey: rideKeys.mine });
    },
  });
  return { publish: mutation.mutateAsync, busy: mutation.isPending };
}
