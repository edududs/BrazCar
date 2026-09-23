import { useQuery } from "@tanstack/react-query";

import { appVersion } from "../adapters/build-info";
import { applyUpdate } from "../adapters/service-worker";
import { fetchMinimumWebVersion } from "../adapters/web-version-gateway";
import type { VersionFloorStatus } from "../domain/app-shell";
import { isBelowFloor } from "./version-floor";

export interface VersionFloor {
  readonly status: VersionFloorStatus;
  readonly version: string;
  /** The only way out of `below-floor`: take the newest build. */
  readonly update: () => void;
}

/**
 * This build against the oldest one the API still serves (D-105), asked again on every focus. An API
 * that does not answer imposes no floor: being offline is the job of the offline screen.
 */
export function useVersionFloor(): VersionFloor {
  const { data, isError } = useQuery({
    queryKey: ["web-version"],
    queryFn: ({ signal }) => fetchMinimumWebVersion(signal),
    retry: false,
    refetchOnWindowFocus: "always",
  });
  const status: VersionFloorStatus =
    data === undefined
      ? isError
        ? "supported"
        : "checking"
      : data !== null && isBelowFloor(appVersion, data)
        ? "below-floor"
        : "supported";
  return {
    status,
    version: appVersion,
    update: () => {
      void applyUpdate();
    },
  };
}
