import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchBoard } from "../adapters/rides-gateway";
import type { BoardFilters, BoardStatus } from "../domain/board";
import type { Ride } from "../domain/ride";
import { rideKeys } from "./keys";

export interface Board {
  readonly rides: readonly Ride[];
  readonly status: BoardStatus;
  /** Ask the API again: what the revision signal calls (ADR-0010). */
  readonly refresh: () => void;
}

/**
 * Headless board: the rides for `filters`, kept while the next filter loads. The list is fetched
 * again on focus and on reconnect (D-048) by TanStack Query's defaults; the signal invalidates it.
 */
export function useBoard(filters: BoardFilters): Board {
  const queryClient = useQueryClient();
  const { data, status } = useQuery({
    queryKey: rideKeys.board(filters),
    queryFn: ({ signal }) => fetchBoard(filters, signal),
    placeholderData: keepPreviousData,
  });

  return {
    rides: data ?? [],
    status: status === "pending" ? "loading" : status === "success" ? "ready" : "failed",
    refresh: () => {
      void queryClient.invalidateQueries({ queryKey: rideKeys.boards });
    },
  };
}
