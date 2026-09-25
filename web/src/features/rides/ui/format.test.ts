import { describe, expect, it } from "vitest";

import type { Stop } from "../domain/ride";
import {
  firstNameOf,
  formatDayChip,
  formatDayLong,
  formatPayment,
  formatPrice,
  formatPriceShort,
  formatRidePrice,
  formatRoute,
  formatSeats,
  formatTime,
  fromLocalInput,
  toLocalInput,
} from "./format";

describe("formatPrice and formatPriceShort", () => {
  it("formats a full currency amount", () => {
    expect(formatPrice("7.00")).toMatch(/^R\$\s?7,00$/);
    expect(formatPrice("8.50")).toMatch(/^R\$\s?8,50$/);
  });

  it("shortens a whole amount, keeps cents otherwise", () => {
    expect(formatPriceShort("7.00")).toBe("R$ 7");
    expect(formatPriceShort("8.50")).toMatch(/^R\$\s?8,50$/);
  });
});

describe("formatRidePrice", () => {
  it("prefixes 'a partir de' only when the ride has fares (D-131)", () => {
    expect(formatRidePrice("7.00", false)).toMatch(/^R\$\s?7,00$/);
    expect(formatRidePrice("7.00", true)).toMatch(/^a partir de R\$\s?7,00$/);
  });
});

describe("time and day formatting", () => {
  const iso = "2026-09-24T07:05:00-03:00";

  it("formats the time as HH:mm", () => {
    expect(formatTime(iso)).toBe("07:05");
  });

  it("formats the day chip without a trailing dot or comma, the weekday and day it names", () => {
    expect(formatDayChip(iso)).not.toContain(".");
    expect(formatDayChip(iso)).not.toContain(",");
    expect(formatDayChip(iso).toLowerCase()).toContain("qui");
    expect(formatDayChip(iso)).toContain("24");
  });

  it("formats the long day, capitalised, without '-feira'", () => {
    const long = formatDayLong(iso);
    expect(long.charAt(0)).toBe(long.charAt(0).toUpperCase());
    expect(long).not.toContain("-feira");
  });
});

describe("formatRoute", () => {
  it("joins every stop's label with an arrow", () => {
    const stops: Stop[] = [
      { placeId: "brazlandia", label: "Brazlândia", fare: null },
      { placeId: null, label: "Incra 8", fare: null },
      { placeId: "esplanada", label: "Esplanada", fare: null },
    ];
    expect(formatRoute(stops)).toBe("Brazlândia → Incra 8 → Esplanada");
  });
});

describe("firstNameOf", () => {
  it("keeps only the first word", () => {
    expect(firstNameOf("Maria das Graças de Albuquerque")).toBe("Maria");
  });

  it("is the whole string when there is only one word", () => {
    expect(firstNameOf("Ana")).toBe("Ana");
  });
});

describe("formatPayment", () => {
  it("joins the methods with 'ou'", () => {
    expect(formatPayment(["cash"])).toBe("dinheiro");
    expect(formatPayment(["cash", "pix"])).toBe("dinheiro ou PIX");
  });
});

describe("formatSeats", () => {
  it("uses the singular only for exactly one", () => {
    expect(formatSeats(1)).toBe("1 vaga");
    expect(formatSeats(0)).toBe("0 vagas");
    expect(formatSeats(3)).toBe("3 vagas");
  });
});

describe("toLocalInput and fromLocalInput", () => {
  it("round-trips through the board's own zone (D-094), not the runner's", () => {
    const iso = "2026-09-24T07:05:00-03:00";
    const local = toLocalInput(iso);
    expect(local).toBe("2026-09-24T07:05");
    expect(fromLocalInput(local)).toBe(new Date(iso).toISOString());
  });
});
