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

  it("is the server's own line for a 5xx, never the gateway's generic one", () => {
    const failure = new AccountRequestError(500, "Não foi possível concluir.");

    expect(reasonOf(failure)).toBe("Falha no servidor. Tente de novo em instantes.");
    expect(reasonOf(failure, { sendsEmail: true })).toBe(
      "Falha no servidor ao enviar o e-mail. Tente de novo em instantes.",
    );
  });

  it("keeps a 4xx detail on the screens that send an e-mail", () => {
    const refusal = new AccountRequestError(409, "E-mail já tem conta.");

    expect(reasonOf(refusal, { sendsEmail: true })).toBe("E-mail já tem conta.");
  });

  it("is a generic line for anything else", () => {
    expect(reasonOf(new Error("network down"))).toBe("Sem resposta do serviço. Tente de novo.");
  });
});
