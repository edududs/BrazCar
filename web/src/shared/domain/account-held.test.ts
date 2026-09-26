import { describe, expect, it } from "vitest";

import { AccountHeldError, heldErrorOf } from "./account-held";

describe("heldErrorOf", () => {
  it("is null for anything that is not a 403", () => {
    expect(
      heldErrorOf(422, { detail: "confira os dados", required_action: "confirm_email" }),
    ).toBeNull();
  });

  it("is null for a 403 with no required_action: that route's own refusal, not the write gate", () => {
    expect(heldErrorOf(403, { detail: "Sem permissão." })).toBeNull();
  });

  it("is null for a 403 with a body that is not the HeldOut shape", () => {
    expect(heldErrorOf(403, "boom")).toBeNull();
    expect(heldErrorOf(403, null)).toBeNull();
    expect(heldErrorOf(403, undefined)).toBeNull();
  });

  it("recognizes the API's HeldOut shape and carries its own phrase (D-168)", () => {
    const held = heldErrorOf(403, {
      detail: "confirme seu e-mail para continuar",
      required_action: "confirm_email",
    });

    expect(held).toBeInstanceOf(AccountHeldError);
    expect(held).toMatchObject({
      action: "confirm_email",
      message: "confirme seu e-mail para continuar",
    });
  });

  it("falls back to its own phrase when the body carries no detail", () => {
    const held = heldErrorOf(403, { required_action: "confirm_email" });

    expect(held?.message).toBe("Confirme seu e-mail para continuar.");
  });
});
