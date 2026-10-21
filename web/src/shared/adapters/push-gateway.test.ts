import { beforeEach, describe, expect, it, vi } from "vitest";

import { PushRequestError } from "../domain/device-push";
import { deletePushSubscription, fetchPushPublicKey, savePushSubscription } from "./push-gateway";

const api = await vi.hoisted(async () => {
  const { installFakeApi } = await import("@/shared/testing/fake-api");
  return installFakeApi();
});

beforeEach(() => {
  api.reset();
});

const subscription = {
  endpoint: "https://push.test/abc",
  keys: { p256dh: "P", auth: "A" },
};

const SAVE_FAILED = "Não foi possível ligar as notificações. Tente de novo.";
const DELETE_FAILED = "Não foi possível desligar as notificações. Tente de novo.";

describe("fetchPushPublicKey", () => {
  it("returns the key", async () => {
    api.answer(200, { public_key: "BKEY" });

    await expect(fetchPushPublicKey()).resolves.toBe("BKEY");
    expect(api.last()).toMatchObject({
      method: "GET",
      path: "/api/push/public-key",
      credentials: "include",
    });
  });

  it("is null when the server has push off (503)", async () => {
    api.answer(503, { detail: "Notificações desligadas." });

    await expect(fetchPushPublicKey()).resolves.toBeNull();
  });

  it("rejects any other failure", async () => {
    api.answer(401, { detail: "Entre para continuar." });

    const attempt = fetchPushPublicKey();

    await expect(attempt).rejects.toBeInstanceOf(PushRequestError);
    await expect(attempt).rejects.toMatchObject({ status: 401, message: "Entre para continuar." });
  });
});

describe("savePushSubscription", () => {
  it("sends the endpoint and keys with the session and resolves on the echo", async () => {
    api.answer(200, { endpoint: subscription.endpoint });

    await expect(savePushSubscription(subscription)).resolves.toBeUndefined();

    expect(api.last()).toMatchObject({
      method: "PUT",
      path: "/api/push/subscriptions",
      credentials: "include",
      body: { endpoint: "https://push.test/abc", keys: { p256dh: "P", auth: "A" } },
    });
  });

  it("rejects a 200 that names another endpoint", async () => {
    api.answer(200, { endpoint: "https://push.test/other" });

    await expect(savePushSubscription(subscription)).rejects.toMatchObject({
      status: 200,
      message: SAVE_FAILED,
    });
  });

  it("rejects a 200 that is the SPA's fallback page", async () => {
    api.answerText(200, "<!doctype html><html><body>BrazCar</body></html>");

    const attempt = savePushSubscription(subscription);

    await expect(attempt).rejects.toBeInstanceOf(PushRequestError);
    await expect(attempt).rejects.toMatchObject({ message: SAVE_FAILED });
  });

  it("rejects with the API's sentence", async () => {
    api.answer(422, { detail: "Endpoint inválido." });

    await expect(savePushSubscription(subscription)).rejects.toMatchObject({
      status: 422,
      message: "Endpoint inválido.",
    });
  });

  it("a validation list is not a sentence, so it asks to try again", async () => {
    api.answer(422, { detail: [{ msg: "bad" }] });

    await expect(savePushSubscription(subscription)).rejects.toMatchObject({
      message: SAVE_FAILED,
    });
  });
});

describe("deletePushSubscription", () => {
  it("sends the endpoint as the body and resolves on 204", async () => {
    api.answerEmpty(204);

    await expect(deletePushSubscription(subscription.endpoint)).resolves.toBeUndefined();

    expect(api.last()).toMatchObject({
      method: "DELETE",
      path: "/api/push/subscriptions",
      credentials: "include",
      body: { endpoint: "https://push.test/abc" },
    });
  });

  it("rejects with its own sentence when the API gives none", async () => {
    api.answerText(502, "<html>Bad Gateway</html>");

    await expect(deletePushSubscription(subscription.endpoint)).rejects.toMatchObject({
      status: 502,
      message: DELETE_FAILED,
    });
  });

  it("rejects with the API's sentence when it gives one", async () => {
    api.answer(400, { detail: "Aparelho desconhecido." });

    await expect(deletePushSubscription(subscription.endpoint)).rejects.toMatchObject({
      message: "Aparelho desconhecido.",
    });
  });
});
