import { describe, expect, it } from "vitest";

import { changesBetween, draftOf } from "./ride-changes";
import { faredRide, openRide } from "./ride.fixture";

describe("draftOf", () => {
  it("fills the form with the stops, the fares and the notes of the ride", () => {
    expect(draftOf(faredRide).stops).toEqual([
      { placeId: "brazlandia", text: "", fare: "" },
      { placeId: null, text: "Incra 8", fare: "9.00" },
      { placeId: "esplanada", text: "", fare: "7.00" },
    ]);
    expect(draftOf(faredRide).notes).toBe("Levo mala pequena e aviso no grupo se atrasar.");
    expect(draftOf(openRide).notes).toBe("");
  });
});

describe("changesBetween", () => {
  it("sends nothing when the form was not touched", () => {
    expect(changesBetween(faredRide, draftOf(faredRide))).toEqual({});
    expect(changesBetween(openRide, draftOf(openRide))).toEqual({});
  });

  it("sends the stops when only a fare moved", () => {
    const draft = draftOf(faredRide);
    const stops = draft.stops.map((stop, index) =>
      index === 1 ? { ...stop, fare: "8.00" } : stop,
    );

    expect(changesBetween(faredRide, { ...draft, stops })).toEqual({ stops });
  });

  it("sends the notes when they are written, rewritten or erased", () => {
    const written = changesBetween(openRide, { ...draftOf(openRide), notes: "Levo mala" });
    const erased = changesBetween(faredRide, { ...draftOf(faredRide), notes: "  " });

    expect(written).toEqual({ notes: "Levo mala" });
    expect(erased).toEqual({ notes: "  " }); // blank is how the API is told to erase them (D-129)
  });
  it("sends the time only when the instant changed, whatever offset it is written in", () => {
    const draft = draftOf(openRide);

    expect(changesBetween(openRide, { ...draft, departureAt: "2026-09-23T10:00:00.000Z" })).toEqual(
      {},
    );
    expect(changesBetween(openRide, { ...draft, departureAt: "2026-09-23T10:30:00.000Z" })).toEqual(
      { departureAt: "2026-09-23T10:30:00.000Z" },
    );
  });

  it("sends the payment methods when the set changed, not when only the order did", () => {
    const both = { ...openRide, paymentMethods: ["pix", "cash"] as const };
    const draft = draftOf(both);

    expect(changesBetween(both, { ...draft, paymentMethods: ["cash", "pix"] })).toEqual({});
    expect(changesBetween(both, { ...draft, paymentMethods: ["cash"] })).toEqual({
      paymentMethods: ["cash"],
    });
  });

  it("sends the price when its value changed, not when only its writing did", () => {
    const draft = draftOf(openRide);

    expect(changesBetween(openRide, { ...draft, price: "7" })).toEqual({});
    expect(changesBetween(openRide, { ...draft, price: "8.50" })).toEqual({ price: "8.50" });
  });
});
