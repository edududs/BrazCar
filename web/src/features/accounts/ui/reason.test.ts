import { describe, expect, it } from "vitest";

import { AccountRequestError } from "../domain/account";
import { reasonOf } from "./reason";

describe("reasonOf", () => {
  it("is the API's own message for an AccountRequestError", () => {
    expect(reasonOf(new AccountRequestError(401, "telefone ou senha incorretos"))).toBe(
      "telefone ou senha incorretos",
    );
  });

  it("is a generic line for anything else", () => {
    expect(reasonOf(new Error("network down"))).toBe("Sem resposta do serviço. Tente de novo.");
  });
});
