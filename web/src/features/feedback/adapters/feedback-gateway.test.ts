import { afterEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/shared/adapters/api/client";

import { FeedbackRequestError } from "../domain/feedback";
import { sendFeedback } from "./feedback-gateway";

vi.mock("@/shared/adapters/api/client", () => ({ apiClient: { POST: vi.fn() } }));

const post = vi.mocked(apiClient.POST);

afterEach(() => {
  vi.resetAllMocks();
});

describe("sendFeedback", () => {
  it("sends the opinion with the build's own version", async () => {
    post.mockResolvedValue({ error: undefined, response: { ok: true } });
    await sendFeedback({ kind: "suggestion", message: "Uma sugestão.", aboutPhone: null });
    expect(post).toHaveBeenCalledWith("/api/feedback", {
      body: {
        kind: "suggestion",
        message: "Uma sugestão.",
        about_phone: null,
        web_version: expect.any(String) as string,
      },
    });
  });

  it("sends the phone a complaint names", async () => {
    post.mockResolvedValue({ error: undefined, response: { ok: true } });
    await sendFeedback({ kind: "complaint", message: "...", aboutPhone: "+5561999990001" });
    expect(post).toHaveBeenCalledWith(
      "/api/feedback",
      expect.objectContaining({
        body: expect.objectContaining({ about_phone: "+5561999990001" }) as object,
      }),
    );
  });

  it("throws the API's refusal, e.g. the daily limit", async () => {
    post.mockResolvedValue({
      error: { detail: "muitas opiniões por hoje; tente amanhã" },
      response: { ok: false, status: 429 },
    });
    await expect(
      sendFeedback({ kind: "complaint", message: "...", aboutPhone: null }),
    ).rejects.toMatchObject({ status: 429, message: "muitas opiniões por hoje; tente amanhã" });
  });

  it("falls back to a generic message with no detail", async () => {
    post.mockResolvedValue({ error: undefined, response: { ok: false, status: 500 } });
    const error: unknown = await sendFeedback({
      kind: "suggestion",
      message: "...",
      aboutPhone: null,
    }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(FeedbackRequestError);
    expect((error as FeedbackRequestError).message).toBe("Não foi possível enviar. Tente de novo.");
  });
});
