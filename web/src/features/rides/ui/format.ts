import type { PaymentMethod, RideStatus, Stop } from "../domain/ride";

/** Presentation only: words and formats. No rule lives here (ADR-0011). */

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const time = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });
const day = new Intl.DateTimeFormat("pt-BR", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
});
const dayLong = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "numeric",
  month: "long",
});
const dayChip = new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "numeric" });

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
