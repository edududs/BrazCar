import { describe, expect, it } from "vitest";

import { AccountHeldError } from "@/shared/domain/account-held";

import { RideRequestError } from "../domain/ride";
import { reasonOf } from "./reason";

describe("reasonOf", () => {
  it("is the API's own message for a RideRequestError", () => {
    expect(reasonOf(new RideRequestError(422, "confira os dados da carona"))).toBe(
      "confira os dados da carona",
    );
  });

  it("is the API's own phrase for a held account, not a generic line (D-168)", () => {
    expect(
      reasonOf(new AccountHeldError("confirm_email", "confirme seu e-mail para continuar")),
    ).toBe("confirme seu e-mail para continuar");
  });

  it("is a generic line for anything else", () => {
    expect(reasonOf(new Error("network down"))).toBe("Sem resposta do serviço. Tente de novo.");
    expect(reasonOf("qualquer coisa")).toBe("Sem resposta do serviço. Tente de novo.");
    expect(reasonOf(undefined)).toBe("Sem resposta do serviço. Tente de novo.");
  });
});
