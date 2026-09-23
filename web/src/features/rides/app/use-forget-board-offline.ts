import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { useNetworkStatus } from "@/shared/app/use-network-status";

import { rideKeys } from "./keys";

/**
 * Empties every board when the network goes (D-051). The page stays mounted under the offline screen,
 * so back online the board loads fresh instead of showing, even for a moment, a list that may have
 * been stale for as long as the phone was offline.
 */
export function useForgetBoardOffline(): void {
  const network = useNetworkStatus();
  const queryClient = useQueryClient();
  useEffect(() => {
    if (network === "offline") void queryClient.resetQueries({ queryKey: rideKeys.boards });
  }, [network, queryClient]);
}
