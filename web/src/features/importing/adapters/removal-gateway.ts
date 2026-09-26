import { apiClient } from "@/shared/adapters/api/client";

import { type RemovalRequestData, RemovalRequestError } from "../domain/removal-request";

function detailOf(error: unknown): string | null {
  if (typeof error === "object" && error !== null && "detail" in error) {
    const { detail } = error;
    if (typeof detail === "string") return detail;
  }
  return null;
}

/**
 * Asks the phone's rides to leave the board (D-172). 202 for every well-formed request, whether
 * the phone has rides on the board or not, so nothing here ever learns that from the answer; only
 * a malformed phone or a note too long (422) and too many requests (429) come back as a refusal.
 */
export async function requestRemoval(data: RemovalRequestData): Promise<void> {
  const { error, response } = await apiClient.POST("/api/removal-requests", {
    body: { phone: data.phone, note: data.note },
  });
  if (!response.ok) {
    throw new RemovalRequestError(
      response.status,
      detailOf(error) ?? "Não foi possível enviar. Tente de novo.",
    );
  }
}
