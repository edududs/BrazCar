import type { PaymentMethod, RideStatus, Stop } from "../domain/ride";

/** Presentation only: words and formats. No rule lives here (ADR-0011). */

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const time = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });
const day = new Intl.DateTimeFormat("pt-BR", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
});

export function formatPrice(price: string): string {
  return currency.format(Number(price));
}

export function formatTime(iso: string): string {
  return time.format(new Date(iso));
}

export function formatDay(iso: string): string {
  return day.format(new Date(iso));
}

export function formatRoute(stops: readonly Stop[]): string {
  return stops.map((stop) => stop.label).join(" → ");
}

export const statusLabel = {
  open: "aberta",
  reopened: "reaberta",
  full: "lotada",
  departed: "já saiu",
  cancelled: "cancelada",
} as const satisfies Record<RideStatus, string>;

export const paymentLabel = {
  cash: "dinheiro",
  pix: "PIX",
} as const satisfies Record<PaymentMethod, string>;

export function formatSeats(seats: number): string {
  return seats === 1 ? "1 vaga" : `${String(seats)} vagas`;
}

/** "YYYY-MM-DDTHH:mm" in the browser's zone, what a `datetime-local` input takes. */
export function toLocalInput(iso: string): string {
  const at = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${String(at.getFullYear())}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}T${pad(at.getHours())}:${pad(at.getMinutes())}`;
}

/** The instant a `datetime-local` value names, as ISO; the API brings it back in the board's zone. */
export function fromLocalInput(local: string): string {
  return new Date(local).toISOString();
}
