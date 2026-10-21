import { relativeDay } from "@/shared/app/calendar";

import type { RideAlert } from "../domain/alert";

/** Presentation only: the words an alert is listed with. */

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** "Hoje", "Amanhã", or the day spelled out: "Sábado, 26 de setembro". */
export function alertDayLabel(day: string, now: Date): string {
  return capitalize(relativeDay(day, now));
}

/** The hours an alert watches: "das 17:00 às 19:00", "a partir de 17:00", "até 19:00". */
export function alertWindowLabel(fromTime: string | null, untilTime: string | null): string {
  if (fromTime !== null && untilTime !== null) return `das ${fromTime} às ${untilTime}`;
  if (fromTime !== null) return `a partir de ${fromTime}`;
  if (untilTime !== null) return `até ${untilTime}`;
  return "qualquer horário";
}

/** "Passa por Incra 8 · das 17:00 às 19:00"; without text, only the window. */
export function alertSummary(alert: Pick<RideAlert, "text" | "fromTime" | "untilTime">): string {
  const window = alertWindowLabel(alert.fromTime, alert.untilTime);
  return alert.text === null ? capitalize(window) : `Passa por ${alert.text} · ${window}`;
}
