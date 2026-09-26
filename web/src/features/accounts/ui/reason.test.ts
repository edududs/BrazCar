import { describe, expect, it } from "vitest";

import { AccountHeldError } from "@/shared/domain/account-held";

import { AccountRequestError } from "../domain/account";
import { reasonOf } from "./reason";

describe("reasonOf", () => {
  it("is the API's own message for an AccountRequestError", () => {
    expect(reasonOf(new AccountRequestError(401, "telefone ou senha incorretos"))).toBe(
      "telefone ou senha incorretos",
    );
  });

  it("is the API's own phrase for a held account, not a generic line (D-168)", () => {
    expect(
      reasonOf(new AccountHeldError("confirm_email", "confirme seu e-mail para continuar")),
    ).toBe("confirme seu e-mail para continuar");
  });

  it("is a generic line for anything else", () => {
    expect(reasonOf(new Error("network down"))).toBe("Sem resposta do serviço. Tente de novo.");
  });
});
