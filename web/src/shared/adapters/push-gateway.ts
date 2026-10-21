import { PushRequestError, type PushSubscriptionData } from "../domain/device-push";
import { apiClient } from "./api/client";

const SAVE_FAILED = "Não foi possível ligar as notificações. Tente de novo.";
const DELETE_FAILED = "Não foi possível desligar as notificações. Tente de novo.";

function detailOf(error: unknown): string | null {
  if (typeof error === "object" && error !== null && "detail" in error) {
    const { detail } = error;
    if (typeof detail === "string") return detail;
  }
  return null;
}

/** True when the text is JSON naming the endpoint that was sent. */
function echoes(text: string, endpoint: string): boolean {
  try {
    const parsed: unknown = JSON.parse(text);
    return (
      typeof parsed === "object" &&
      parsed !== null &&
      "endpoint" in parsed &&
      parsed.endpoint === endpoint
    );
  } catch {
    return false;
  }
}

/** The key the browser subscribes with; null when the server has push turned off (503). */
export async function fetchPushPublicKey(): Promise<string | null> {
  const { data, error, response } = await apiClient.GET("/api/push/public-key");
  if (response.status === 503) return null;
  if (data === undefined) {
    throw new PushRequestError(response.status, detailOf(error) ?? SAVE_FAILED);
  }
  return data.public_key;
}

/**
 * Stores this device's subscription. Only a 200 whose JSON echoes the endpoint counts: a 200 with
 * the SPA's fallback page is not a saved subscription.
 */
export async function savePushSubscription(subscription: PushSubscriptionData): Promise<void> {
  const { data, error, response } = await apiClient.PUT("/api/push/subscriptions", {
    body: {
      endpoint: subscription.endpoint,
      keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
    },
    // Read as text so a fallback page cannot throw inside the client before the check below.
    parseAs: "text",
  });
  if (response.ok && typeof data === "string" && echoes(data, subscription.endpoint)) return;
  throw new PushRequestError(response.status, detailOf(error) ?? SAVE_FAILED);
}

/** Forgets one subscription on the server. */
export async function deletePushSubscription(endpoint: string): Promise<void> {
  const { error, response } = await apiClient.DELETE("/api/push/subscriptions", {
    body: { endpoint },
  });
  if (response.status === 204) return;
  throw new PushRequestError(response.status, detailOf(error) ?? DELETE_FAILED);
}
