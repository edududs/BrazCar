import { apiClient } from "@/shared/adapters/api/client";
import { appVersion } from "@/shared/adapters/build-info";

import { type FeedbackData, FeedbackRequestError } from "../domain/feedback";

function detailOf(error: unknown): string | null {
  if (typeof error === "object" && error !== null && "detail" in error) {
    const { detail } = error;
    if (typeof detail === "string") return detail;
  }
  return null;
}

/** Sends one opinion with the build it came from, so a bug report can be told from an old front. */
export async function sendFeedback(data: FeedbackData): Promise<void> {
  const { error, response } = await apiClient.POST("/api/feedback", {
    body: {
      kind: data.kind,
      message: data.message,
      about_phone: data.aboutPhone,
      web_version: appVersion,
    },
  });
  if (!response.ok) {
    throw new FeedbackRequestError(
      response.status,
      detailOf(error) ?? "Não foi possível enviar. Tente de novo.",
    );
  }
}
