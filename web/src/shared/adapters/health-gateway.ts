import { apiClient } from "./api/client";

/** Resolves when the API answers healthy; rejects on network failure or any error status. */
export async function checkServiceHealth(signal: AbortSignal): Promise<void> {
  const { response } = await apiClient.GET("/api/health", { signal });
  if (!response.ok) {
    throw new Error(`API health check failed with status ${String(response.status)}`);
  }
}
