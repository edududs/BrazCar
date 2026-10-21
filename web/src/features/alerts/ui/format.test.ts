import { describe, expect, it } from "vitest";

import { alertDayLabel, alertSummary, alertWindowLabel } from "./format";

const NOW = new Date("2026-09-24T15:00:00-03:00");

describe("alertDayLabel", () => {
  it("names today and tomorrow", () => {
    expect(alertDayLabel("2026-09-24", NOW)).toBe("Hoje");
    expect(alertDayLabel("2026-09-25", NOW)).toBe("Amanhã");
  });

  it("spells out a later day with a capital", () => {
    expect(alertDayLabel("2026-09-26", NOW)).toBe("Sábado, 26 de setembro");
  });
});

describe("alertWindowLabel", () => {
  it("says both ends, one end or none", () => {
    expect(alertWindowLabel("17:00", "19:00")).toBe("das 17:00 às 19:00");
    expect(alertWindowLabel("17:00", null)).toBe("a partir de 17:00");
    expect(alertWindowLabel(null, "19:00")).toBe("até 19:00");
    expect(alertWindowLabel(null, null)).toBe("qualquer horário");
  });
});

describe("alertSummary", () => {
  it("joins the text and the window", () => {
    expect(alertSummary({ text: "Incra 8", fromTime: "17:00", untilTime: "19:00" })).toBe(
      "Passa por Incra 8 · das 17:00 às 19:00",
    );
    expect(alertSummary({ text: "Incra 8", fromTime: null, untilTime: null })).toBe(
      "Passa por Incra 8 · qualquer horário",
    );
  });

  it("is only the window, capitalized, without text", () => {
    expect(alertSummary({ text: null, fromTime: null, untilTime: null })).toBe("Qualquer horário");
    expect(alertSummary({ text: null, fromTime: "17:00", untilTime: null })).toBe(
      "A partir de 17:00",
    );
  });
});
