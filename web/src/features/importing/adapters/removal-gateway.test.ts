import { beforeEach, describe, expect, it, vi } from "vitest";

import { RemovalRequestError } from "../domain/removal-request";
import { requestRemoval } from "./removal-gateway";

const api = await vi.hoisted(async () => {
  const { installFakeApi } = await import("@/shared/testing/fake-api");
  return installFakeApi();
});

beforeEach(() => {
  api.reset();
});

describe("requestRemoval", () => {
  it("sends the phone and the note with the API's names", async () => {
    api.answer(202, { ok: true });

    await requestRemoval({ phone: "+5561999990002", note: "Não anuncio mais nesse número." });

    expect(api.last()).toMatchObject({
      method: "POST",
      path: "/api/removal-requests",
      body: { phone: "+5561999990002", note: "Não anuncio mais nesse número." },
    });
  });

  it("a request with no explanation sends the note as null", async () => {
    api.answer(202, { ok: true });

    await requestRemoval({ phone: "+5561999990002", note: null });

    expect(api.last().body).toMatchObject({ note: null });
  });

  it("a malformed phone (422) comes back with the API's sentence", async () => {
    api.answer(422, { detail: "Telefone inválido." });

    const attempt = requestRemoval({ phone: "+5561999990002", note: null });

    await expect(attempt).rejects.toBeInstanceOf(RemovalRequestError);
    await expect(attempt).rejects.toMatchObject({ status: 422, message: "Telefone inválido." });
  });

  it("the limit reached (429) comes back with the API's sentence", async () => {
    api.answer(429, { detail: "Muitos pedidos hoje. Tente de novo amanhã." });

    const attempt = requestRemoval({ phone: "+5561999990002", note: null });

    await expect(attempt).rejects.toMatchObject({
      status: 429,
      message: "Muitos pedidos hoje. Tente de novo amanhã.",
    });
  });

  it("a failure without a sentence asks to try again", async () => {
    api.answerText(502, "<html>Bad Gateway</html>");

    await expect(requestRemoval({ phone: "+5561999990002", note: null })).rejects.toMatchObject({
      status: 502,
      message: "Não foi possível enviar. Tente de novo.",
    });
  });

  it("a validation list is not a sentence, so it also asks to try again", async () => {
    api.answer(422, { detail: [{ msg: "bad" }] });

    await expect(requestRemoval({ phone: "invalid", note: null })).rejects.toMatchObject({
      message: "Não foi possível enviar. Tente de novo.",
    });
  });
});
