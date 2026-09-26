import { BOARD_TIME_ZONE } from "@/shared/domain/board-time-zone";

/** Presentation only: words and formats. No rule lives here (ADR-0011). */

// Every clock the invite shows reads the board's own zone (D-094, D-165), never the device's.
const expiryDate = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  timeZone: BOARD_TIME_ZONE,
});
const expiryTime = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: BOARD_TIME_ZONE,
});

/** "26/09 às 18:00", no fuso do mural: quando o convite deixa de valer (D-165). */
export function formatInviteExpiry(iso: string): string {
  const at = new Date(iso);
  return `${expiryDate.format(at)} às ${expiryTime.format(at)}`;
}
