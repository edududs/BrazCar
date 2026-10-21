// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DevicePush } from "@/shared/app/use-device-push";
import { renderRouted } from "@/shared/testing/render-routed";

import { MyAlerts } from "./my-alerts";

const api = await vi.hoisted(async () => {
  const { installFakeApi } = await import("@/shared/testing/fake-api");
  return installFakeApi();
});

const NOW = new Date("2026-09-24T15:00:00-03:00");

const tomorrow = {
  id: "al1",
  text: "Incra 8",
  day: "2026-09-25",
  from_time: "17:00:00",
  until_time: null,
  created_at: "2026-09-24T12:00:00-03:00",
};
const saturday = {
  id: "al2",
  text: null,
  day: "2026-09-26",
  from_time: null,
  until_time: null,
  created_at: "2026-09-24T12:30:00-03:00",
};

function fakePush(overrides: Partial<DevicePush> = {}): DevicePush {
  return {
    permission: "default",
    subscribed: false,
    pending: false,
    error: null,
    enable: vi.fn(() => Promise.resolve()),
    disable: vi.fn(() => Promise.resolve()),
    ...overrides,
  };
}

function show(push: DevicePush = fakePush()): void {
  renderRouted(<MyAlerts accountId="a1" push={push} now={NOW} />);
}

const TRASH_TOMORROW = "Apagar aviso de Amanhã, Passa por Incra 8 · a partir de 17:00";
const TRASH_SATURDAY = "Apagar aviso de Sábado, 26 de setembro, Qualquer horário";

beforeEach(() => {
  api.reset();
});

describe("MyAlerts", () => {
  it("lists the alerts with the count against the API's limit", async () => {
    api.serve("GET", "/api/alerts", 200, { alerts: [tomorrow, saturday], limit: 5 });

    show();

    expect(await screen.findByText("Passa por Incra 8 · a partir de 17:00")).toBeDefined();
    expect(screen.getByText("Amanhã")).toBeDefined();
    expect(screen.getByText("Sábado, 26 de setembro")).toBeDefined();
    expect(screen.getByText("Qualquer horário")).toBeDefined();
    expect(screen.getByText("2 de 5")).toBeDefined();
    expect(screen.getByRole("button", { name: TRASH_TOMORROW })).toBeDefined();
    expect(screen.getByRole("button", { name: TRASH_SATURDAY })).toBeDefined();
  });

  it("says it is loading, with no count yet", async () => {
    api.serve("GET", "/api/alerts", 200, { alerts: [], limit: 5 });

    show();

    expect(await screen.findByText("Carregando seus avisos…")).toBeDefined();
    expect(screen.queryByText(/ de 5$/)).toBeNull();
    await screen.findByText("Nenhum aviso ativo.");
  });

  it("says how to make the first one when there is none", async () => {
    api.serve("GET", "/api/alerts", 200, { alerts: [], limit: 5 });

    show();

    expect(await screen.findByText("Nenhum aviso ativo.")).toBeDefined();
    expect(screen.getByText("No mural, toque em Me avise.")).toBeDefined();
    expect(screen.getByText("0 de 5")).toBeDefined();
  });

  it("says when the list could not be loaded", async () => {
    api.serve("GET", "/api/alerts", 500, { detail: "erro" });

    show();

    expect(await screen.findByText("Não foi possível carregar seus avisos.")).toBeDefined();
    expect(screen.queryByText(/ de \d+$/)).toBeNull();
  });

  it("drops an alert by touch and loads the list again", async () => {
    const user = userEvent.setup();
    api.serve("GET", "/api/alerts", 200, { alerts: [tomorrow, saturday], limit: 5 });
    show();
    const trash = await screen.findByRole("button", { name: TRASH_TOMORROW });
    api.serve("GET", "/api/alerts", 200, { alerts: [saturday], limit: 5 });
    api.answerEmpty(204);

    await user.click(trash);

    expect(await screen.findByText("1 de 5")).toBeDefined();
    expect(api.sentTo("DELETE", "/api/alerts/al1")).toHaveLength(1);
    expect(screen.queryByText("Amanhã")).toBeNull();
  });

  it("drops an alert by keyboard alone", async () => {
    const user = userEvent.setup();
    api.serve("GET", "/api/alerts", 200, { alerts: [tomorrow], limit: 5 });
    show();
    const trash = await screen.findByRole("button", { name: TRASH_TOMORROW });
    api.answerEmpty(204);

    for (let step = 0; step < 10 && document.activeElement !== trash; step += 1) {
      await user.tab();
    }
    expect(document.activeElement).toBe(trash);
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(api.sentTo("DELETE", "/api/alerts/al1")).toHaveLength(1);
    });
  });

  it("disables the button of the alert being dropped", async () => {
    const user = userEvent.setup();
    api.serve("GET", "/api/alerts", 200, { alerts: [tomorrow, saturday], limit: 5 });
    show();
    const trash = await screen.findByRole("button", { name: TRASH_TOMORROW });
    api.answerEmpty(204);

    const clicking = user.click(trash);

    await waitFor(() => {
      expect(trash).toHaveProperty("disabled", true);
    });
    expect(screen.getByRole("button", { name: TRASH_SATURDAY })).toHaveProperty("disabled", false);
    await clicking;
    await waitFor(() => {
      expect(trash).toHaveProperty("disabled", false);
    });
  });

  it("shows the notice with the way to the account when the account is held", async () => {
    const user = userEvent.setup();
    api.serve("GET", "/api/alerts", 200, { alerts: [tomorrow], limit: 5 });
    show();
    const trash = await screen.findByRole("button", { name: TRASH_TOMORROW });
    api.answer(403, {
      detail: "Confirme seu e-mail para continuar.",
      required_action: "confirm_email",
    });

    await user.click(trash);

    const notice = await screen.findByRole("alert");
    expect(notice.textContent).toContain("Confirme seu e-mail para continuar.");
    expect(screen.getByRole("link", { name: "Ir para minha conta" })).toBeDefined();
  });

  it("shows the API's sentence when it refuses the removal", async () => {
    const user = userEvent.setup();
    api.serve("GET", "/api/alerts", 200, { alerts: [tomorrow], limit: 5 });
    show();
    const trash = await screen.findByRole("button", { name: TRASH_TOMORROW });
    api.answer(404, { detail: "Aviso não encontrado." });

    await user.click(trash);

    expect((await screen.findByRole("alert")).textContent).toBe("Aviso não encontrado.");
  });

  it("says nothing answered when the failure is not the API's sentence", async () => {
    const user = userEvent.setup();
    api.serve("GET", "/api/alerts", 200, { alerts: [tomorrow], limit: 5 });
    show();
    const trash = await screen.findByRole("button", { name: TRASH_TOMORROW });
    api.dropConnection();

    await user.click(trash);

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Sem resposta do serviço. Tente de novo.",
    );
  });

  it("holds the device's notifications under their own heading", async () => {
    const user = userEvent.setup();
    const push = fakePush();
    api.serve("GET", "/api/alerts", 200, { alerts: [], limit: 5 });

    show(push);

    expect(
      await screen.findByRole("heading", { name: "Notificações neste aparelho" }),
    ).toBeDefined();
    await user.click(screen.getByRole("button", { name: "Ativar notificações" }));
    expect(push.enable).toHaveBeenCalledOnce();
  });
});
