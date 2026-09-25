import { BOARD_TIME_ZONE, BOARD_UTC_OFFSET } from "@/shared/domain/board-time-zone";

import type { PaymentMethod, RideStatus, Stop } from "../domain/ride";

/** Presentation only: words and formats. No rule lives here (ADR-0011). */

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
// Every clock and calendar below reads the board's own zone (D-094), never the device's: a
// passenger abroad, or with the wrong clock, must still see the ride at its real board time.
const time = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: BOARD_TIME_ZONE,
});
const day = new Intl.DateTimeFormat("pt-BR", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  timeZone: BOARD_TIME_ZONE,
});
const dayLong = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: BOARD_TIME_ZONE,
});
const dayChip = new Intl.DateTimeFormat("pt-BR", {
  weekday: "short",
  day: "numeric",
  timeZone: BOARD_TIME_ZONE,
});
const localInputParts = new Intl.DateTimeFormat("sv-SE", {
  timeZone: BOARD_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function formatPrice(price: string): string {
  return currency.format(Number(price));
}

/** "R$ 7" when whole, "R$ 8,50" otherwise: the card's short form. */
export function formatPriceShort(price: string): string {
  const value = Number(price);
  return Number.isInteger(value) ? `R$ ${String(value)}` : currency.format(value);
}

/** The ride's price, said as a "from" price when the stops carry their own fares (D-131). */
export function formatRidePrice(price: string, hasFares: boolean): string {
  return hasFares ? `a partir de ${formatPrice(price)}` : formatPrice(price);
}

export function formatTime(iso: string): string {
  return time.format(new Date(iso));
}

export function formatDay(iso: string): string {
  return day.format(new Date(iso));
}

/** "Quinta, 24 de setembro": the detail's day line. */
export function formatDayLong(iso: string): string {
  const text = dayLong.format(new Date(iso)).replace("-feira", "");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "qui 24": the day beside the time, on a list that spans days. */
export function formatDayChip(iso: string): string {
  return dayChip.format(new Date(iso)).replace(".", "").replace(",", "");
}

export function formatRoute(stops: readonly Stop[]): string {
  return stops.map((stop) => stop.label).join(" → ");
}

/** The person's first name, for "Observações de Ana". */
export function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

export const statusLabel = {
  open: "Aberta",
  reopened: "Reaberta",
  full: "Lotada",
  departed: "Já saiu",
  cancelled: "Cancelada",
} as const satisfies Record<RideStatus, string>;

export const paymentLabel = {
  cash: "dinheiro",
  pix: "PIX",
} as const satisfies Record<PaymentMethod, string>;

export function formatPayment(methods: readonly PaymentMethod[]): string {
  return methods.map((method) => paymentLabel[method]).join(" ou ");
}

export function formatSeats(seats: number): string {
  return seats === 1 ? "1 vaga" : `${String(seats)} vagas`;
}

/**
 * "YYYY-MM-DDTHH:mm" for a `datetime-local` input, in the board's own zone (D-094): the native
 * control shows whatever digits it is given, so those digits must already be the board's clock,
 * not the device's, or a driver abroad would repeat a ride at the wrong real time.
 */
export function toLocalInput(iso: string): string {
  return localInputParts.format(new Date(iso)).replace(" ", "T");
}

/** The instant a `datetime-local` value names, read as the board's own wall clock (D-094). */
export function fromLocalInput(local: string): string {
  return new Date(`${local}:00${BOARD_UTC_OFFSET}`).toISOString();
}
