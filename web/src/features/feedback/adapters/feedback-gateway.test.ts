import { beforeEach, describe, expect, it, vi } from "vitest";

import { appVersion } from "@/shared/adapters/build-info";

import { FeedbackRequestError } from "../domain/feedback";
import { sendFeedback } from "./feedback-gateway";

const api = await vi.hoisted(async () => {
  const { installFakeApi } = await import("@/shared/testing/fake-api");
  return installFakeApi();
});

beforeEach(() => {
  api.reset();
});

describe("sendFeedback", () => {
  it("sends the opinion with the API's names and the build it came from", async () => {
    api.answer(201, { ok: true });

    await sendFeedback({ kind: "complaint", message: "Atrasou.", aboutPhone: "+5561999990002" });

    expect(api.last()).toMatchObject({
      method: "POST",
      path: "/api/feedback",
      credentials: "include",
      body: {
        kind: "complaint",
        message: "Atrasou.",
        about_phone: "+5561999990002",
        web_version: appVersion,
      },
    });
  });

  it("an opinion about nobody sends the phone as null", async () => {
    api.answer(201, { ok: true });

    await sendFeedback({ kind: "praise", message: "Ótimo.", aboutPhone: null });

    expect(api.last().body).toMatchObject({ about_phone: null });
  });

  it("the limit reached (429) comes back with the API's sentence", async () => {
    api.answer(429, { detail: "Você já mandou opiniões demais hoje." });

    const attempt = sendFeedback({ kind: "suggestion", message: "x", aboutPhone: null });

    await expect(attempt).rejects.toBeInstanceOf(FeedbackRequestError);
    await expect(attempt).rejects.toMatchObject({
      status: 429,
      message: "Você já mandou opiniões demais hoje.",
    });
  });

  it("a failure without a sentence asks to try again", async () => {
    api.answerText(502, "<html>Bad Gateway</html>");

    await expect(
      sendFeedback({ kind: "suggestion", message: "x", aboutPhone: null }),
    ).rejects.toMatchObject({ status: 502, message: "Não foi possível enviar. Tente de novo." });
  });

  it("a validation list is not a sentence, so it also asks to try again", async () => {
    api.answer(422, { detail: [{ msg: "bad" }] });

    await expect(
      sendFeedback({ kind: "suggestion", message: "", aboutPhone: null }),
    ).rejects.toMatchObject({ message: "Não foi possível enviar. Tente de novo." });
  });
});
