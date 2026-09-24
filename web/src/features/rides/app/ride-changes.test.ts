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
});
