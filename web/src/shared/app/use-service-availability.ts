import { useQuery } from "@tanstack/react-query";

import { checkServiceHealth } from "../adapters/health-gateway";
import type { ServiceAvailability } from "../domain/service-availability";

export function useServiceAvailability(): ServiceAvailability {
  const { status } = useQuery({
    queryKey: ["service-health"],
    queryFn: async ({ signal }) => {
      await checkServiceHealth(signal);
      return true;
    },
    retry: false,
  });

  switch (status) {
    case "pending":
      return "checking";
    case "success":
      return "online";
    case "error":
      return "offline";
  }
}
