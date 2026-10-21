import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { deleteAlert, fetchAlerts } from "../adapters/alerts-gateway";
import type { RideAlert } from "../domain/alert";
import { alertKeys } from "./keys";

export interface MyAlerts {
  readonly status: "loading" | "ready" | "failed";
  readonly alerts: readonly RideAlert[];
  /** How many alerts the account may have; null until the list loads. */
  readonly limit: number | null;
  readonly remove: (alertId: string) => Promise<void>;
  /** The alert being removed, or null. */
  readonly removing: string | null;
}

/** The account's active alerts and the removal of one. Off while there is no account. */
export function useMyAlerts(accountId: string | null): MyAlerts {
  const queryClient = useQueryClient();
  const { data, status } = useQuery({
    queryKey: alertKeys.mine(accountId ?? ""),
    queryFn: ({ signal }) => fetchAlerts(signal),
    enabled: accountId !== null,
    retry: false,
  });
  const removal = useMutation({
    mutationFn: (alertId: string) => deleteAlert(alertId),
    onSuccess: () => {
      if (accountId !== null) {
        void queryClient.invalidateQueries({ queryKey: alertKeys.mine(accountId) });
      }
    },
  });
  return {
    status: status === "pending" ? "loading" : status === "success" ? "ready" : "failed",
    alerts: data?.alerts ?? [],
    limit: data?.limit ?? null,
    remove: removal.mutateAsync,
    removing: removal.isPending ? removal.variables : null,
  };
}
