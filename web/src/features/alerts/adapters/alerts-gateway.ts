import { apiClient } from "@/shared/adapters/api/client";
import type { components } from "@/shared/adapters/api/schema";
import { heldErrorOf } from "@/shared/domain/account-held";

import {
  type ActiveAlerts,
  type AlertData,
  AlertRequestError,
  type RideAlert,
} from "../domain/alert";

type AlertOut = components["schemas"]["AlertOut"];

const INVALID = "Confira os dados do aviso.";
const NO_ANSWER = "Sem resposta do serviço. Tente de novo.";
const FALLBACK = "Não foi possível concluir.";

/** The API speaks "HH:MM:SS"; the rest of the front only sees "HH:MM". */
function toClock(time: string | null): string | null {
  return time === null ? null : time.slice(0, 5);
}

function toAlert(out: AlertOut): RideAlert {
  return {
    id: out.id,
    text: out.text,
    day: out.day,
    fromTime: toClock(out.from_time),
    untilTime: toClock(out.until_time),
    createdAt: out.created_at,
  };
}

function detailOf(error: unknown): string | null {
  if (typeof error === "object" && error !== null && "detail" in error) {
    const { detail } = error;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) return INVALID;
  }
  return null;
}

/** Held accounts first (D-168), then the API's own sentence for a 4xx and ours for a 5xx (D-173). */
function refused(status: number, error: unknown): Error {
  const held = heldErrorOf(status, error);
  if (held !== null) return held;
  if (status >= 500) return new AlertRequestError(status, NO_ANSWER);
  return new AlertRequestError(status, detailOf(error) ?? FALLBACK);
}

export async function fetchAlerts(signal: AbortSignal): Promise<ActiveAlerts> {
  const { data, error, response } = await apiClient.GET("/api/alerts", { signal });
  if (data === undefined) throw refused(response.status, error);
  return { alerts: data.alerts.map(toAlert), limit: data.limit };
}

export async function createAlert(alert: AlertData): Promise<RideAlert> {
  const { data, error, response } = await apiClient.POST("/api/alerts", {
    body: {
      day: alert.day,
      text: alert.text,
      from_time: alert.fromTime,
      until_time: alert.untilTime,
    },
  });
  if (data === undefined) throw refused(response.status, error);
  return toAlert(data);
}

export async function deleteAlert(alertId: string): Promise<void> {
  const { error, response } = await apiClient.DELETE("/api/alerts/{alert_id}", {
    params: { path: { alert_id: alertId } },
  });
  if (!response.ok) throw refused(response.status, error);
}
