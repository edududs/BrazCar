import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";

import { useDebouncedValue } from "@/shared/app/use-debounced-value";

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

const TYPING_PAUSE_MS = 250;

interface BoardOptions {
  readonly typingPauseMs?: number;
}

/**
 * Headless board: the rides for `filters`, kept while the next filter loads. The list is fetched
 * again on focus and on reconnect (D-048) by TanStack Query's defaults; the signal invalidates it.
 */
export function useBoard(
  filters: BoardFilters,
  { typingPauseMs = TYPING_PAUSE_MS }: BoardOptions = {},
): Board {
  const queryClient = useQueryClient();
  // The text is typed a letter at a time; the API is asked once the typing pauses.
  const text = useDebouncedValue(filters.text, typingPauseMs);
  const settled: BoardFilters = { ...filters, text };
  const { data, status } = useQuery({
    queryKey: rideKeys.board(settled),
    queryFn: ({ signal }) => fetchBoard(settled, signal),
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
