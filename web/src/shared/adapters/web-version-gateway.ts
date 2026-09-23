import { apiClient } from "./api/client";

/** The oldest front version the API still serves, or null when it does not say (D-105). */
export async function fetchMinimumWebVersion(signal: AbortSignal): Promise<string | null> {
  const { data } = await apiClient.GET("/api/web-version", { signal });
  return data?.minimum ?? null;
}
