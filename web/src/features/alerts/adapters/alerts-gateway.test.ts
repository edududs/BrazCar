import { beforeEach, describe, expect, it, vi } from "vitest";

import { AccountHeldError } from "@/shared/domain/account-held";

import { AlertRequestError } from "../domain/alert";
import { createAlert, deleteAlert, fetchAlerts } from "./alerts-gateway";

const api = await vi.hoisted(async () => {
  const { installFakeApi } = await import("@/shared/testing/fake-api");
  return installFakeApi();
});

const alertOut = {
  id: "a1",
  text: "Gol prata",
  day: "2026-09-26",
  from_time: "07:30:00",
  until_time: null,
  created_at: "2026-09-24T12:00:00-03:00",
};

const data = { day: "2026-09-26", text: null, fromTime: "07:30", untilTime: null };
const signal = new AbortController().signal;

async function refusal(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("The call was expected to fail.");
}

beforeEach(() => {
  api.reset();
});

describe("reading the alerts", () => {
  it("maps the list and cuts the seconds off the times", async () => {
    api.answer(200, { alerts: [alertOut], limit: 5 });

    const active = await fetchAlerts(signal);

    expect(api.last()).toMatchObject({ method: "GET", path: "/api/alerts" });
    expect(active).toEqual({
      limit: 5,
      alerts: [
        {
          id: "a1",
          text: "Gol prata",
          day: "2026-09-26",
          fromTime: "07:30",
          untilTime: null,
          createdAt: "2026-09-24T12:00:00-03:00",
        },
      ],
    });
  });

  it("fails with the API's sentence on a 4xx", async () => {
    api.answer(401, { detail: "Entre para continuar." });

    const error = await refusal(fetchAlerts(signal));

    expect(error).toBeInstanceOf(AlertRequestError);
    expect(error).toMatchObject({ status: 401, message: "Entre para continuar." });
  });
});

describe("creating an alert", () => {
  it("sends the API's own names and maps the answer", async () => {
    api.answer(201, { ...alertOut, text: null });

    const created = await createAlert(data);

    expect(api.last()).toMatchObject({
      method: "POST",
      path: "/api/alerts",
      body: { day: "2026-09-26", text: null, from_time: "07:30", until_time: null },
    });
    expect(created).toMatchObject({ id: "a1", fromTime: "07:30", untilTime: null });
  });

  it("keeps the sentence of a 422", async () => {
    api.answer(422, { detail: "Você já tem 5 avisos." });

    const error = await refusal(createAlert(data));

    expect(error).toMatchObject({ status: 422, message: "Você já tem 5 avisos." });
  });

  it("turns a field validation list into one sentence", async () => {
    api.answer(422, { detail: [{ loc: ["body", "day"], msg: "bad", type: "x" }] });

    const error = await refusal(createAlert(data));

    expect(error).toMatchObject({ status: 422, message: "Confira os dados do aviso." });
  });

  it("uses its own sentence for a 5xx", async () => {
    api.answerText(502, "<html>Bad gateway</html>");

    const error = await refusal(createAlert(data));

    expect(error).toMatchObject({
      status: 502,
      message: "Sem resposta do serviço. Tente de novo.",
    });
  });

  it("has a fallback for a 4xx without a sentence", async () => {
    api.answer(400, {});

    const error = await refusal(createAlert(data));

    expect(error).toMatchObject({ status: 400, message: "Não foi possível concluir." });
  });

  it("a held account's 403 becomes an AccountHeldError (D-168)", async () => {
    api.answer(403, {
      detail: "confirme seu e-mail para continuar",
      required_action: "confirm_email",
    });

    const error = await refusal(createAlert(data));

    expect(error).toBeInstanceOf(AccountHeldError);
  });

  it("lets a dropped connection rise as it is", async () => {
    api.dropConnection();

    const error = await refusal(createAlert(data));

    expect(error).toBeInstanceOf(TypeError);
  });
});

describe("deleting an alert", () => {
  it("resolves on a 204", async () => {
    api.answerEmpty(204);

    await deleteAlert("a1");

    expect(api.last()).toMatchObject({ method: "DELETE", path: "/api/alerts/a1" });
  });

  it("fails with the sentence of a 404", async () => {
    api.answer(404, { detail: "Aviso não encontrado." });

    const error = await refusal(deleteAlert("a1"));

    expect(error).toMatchObject({ status: 404, message: "Aviso não encontrado." });
  });
});
