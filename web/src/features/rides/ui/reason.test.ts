import { describe, expect, it } from "vitest";

import { RideRequestError } from "../domain/ride";
import { reasonOf } from "./reason";

describe("reasonOf", () => {
  it("is the API's own message for a RideRequestError", () => {
    expect(reasonOf(new RideRequestError(422, "confira os dados da carona"))).toBe(
      "confira os dados da carona",
    );
  });

  it("is a generic line for anything else", () => {
    expect(reasonOf(new Error("network down"))).toBe("Sem resposta do serviço. Tente de novo.");
    expect(reasonOf("qualquer coisa")).toBe("Sem resposta do serviço. Tente de novo.");
    expect(reasonOf(undefined)).toBe("Sem resposta do serviço. Tente de novo.");
  });
});
