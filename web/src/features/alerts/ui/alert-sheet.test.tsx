// @vitest-environment jsdom
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { driverOut, heldOut } from "@/shared/adapters/api-answers.fixture";
import type { DevicePush } from "@/shared/app/use-device-push";
import { renderRouted } from "@/shared/testing/render-routed";

import type { AlertSeed } from "../app/use-alert-draft";
import { AlertSheet } from "./alert-sheet";

const api = await vi.hoisted(async () => {
  const { installFakeApi } = await import("@/shared/testing/fake-api");
  return installFakeApi();
});

const pushState = vi.hoisted(() => ({ current: null as DevicePush | null }));

vi.mock("@/shared/app/use-device-push", () => ({
  useDevicePush: (): DevicePush => {
    if (pushState.current === null) throw new Error("The test forgot to set the push double.");
    return pushState.current;
  },
}));

const NOW = new Date("2026-09-24T15:00:00-03:00");
const SEED: AlertSeed = { day: "2026-09-26", text: "incra", fromTime: "18:00" };
const RETURN_TO = "/?q=incra&from=%2218%3A00%22";
const UNAVAILABLE = "As notificações não estão disponíveis no momento.";

const created = {
  id: "al1",
  text: "incra",
  day: "2026-09-26",
  from_time: "18:00:00",
  until_time: null,
  created_at: "2026-09-24T15:00:00-03:00",
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

function Harness({ onClosed }: { readonly onClosed?: () => void }) {
  const [open, setOpen] = useState(true);
  return (
    <AlertSheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) onClosed?.();
      }}
      seed={SEED}
      now={NOW}
      returnTo={RETURN_TO}
    />
  );
}

/** The open sheet; with `ready`, once that button is there (the session has been read). */
async function openSheet(onClosed?: () => void, ready: string | null = "Criar aviso") {
  renderRouted(<Harness {...(onClosed === undefined ? {} : { onClosed })} />);
  // The sheet is rebuilt once the session says who is asking: take the dialog after that.
  if (ready !== null) await screen.findByRole("button", { name: ready });
  return screen.findByRole("dialog");
}

function signedIn(account: typeof driverOut = driverOut): void {
  api.serve("GET", "/api/accounts/me", 200, account);
}

beforeEach(() => {
  api.reset();
  pushState.current = fakePush();
});

describe("AlertSheet for a visitor", () => {
  it("invites to sign in and brings the board's address along", async () => {
    api.serve("GET", "/api/accounts/me", 401, { detail: "Não autenticado." });

    const dialog = await openSheet(undefined, null);

    expect(within(dialog).getByText("Me avise")).toBeDefined();
    expect(
      await within(dialog).findByText("Entre para ser avisado quando aparecer carona."),
    ).toBeDefined();
    const link = within(dialog).getByRole("link", { name: "Entrar" });
    const href = link.getAttribute("href") ?? "";
    expect(href.startsWith("/entrar?")).toBe(true);
    expect(decodeURIComponent(href)).toContain(RETURN_TO);
    expect(within(dialog).queryByRole("button", { name: "Criar aviso" })).toBeNull();
  });

  it("says it is checking while the session is read", async () => {
    api.serve("GET", "/api/accounts/me", 200, driverOut);

    const dialog = await openSheet(undefined, null);

    expect(within(dialog).getByText("Verificando…")).toBeDefined();
    await screen.findByRole("button", { name: "Criar aviso" });
  });
});

describe("AlertSheet for a held account", () => {
  it("shows what it owes and asks for nothing", async () => {
    signedIn(heldOut);

    const dialog = await openSheet(undefined, null);

    const notice = await within(dialog).findByRole("alert");
    expect(notice.textContent).toContain("Confirme seu e-mail para continuar.");
    expect(within(dialog).getByRole("link", { name: "Ir para minha conta" })).toBeDefined();
    expect(within(dialog).queryByRole("textbox")).toBeNull();
    expect(within(dialog).queryByRole("button", { name: "Criar aviso" })).toBeNull();
  });
});

describe("AlertSheet for an account in good standing", () => {
  it("starts from the board's filters", async () => {
    signedIn();

    const dialog = await openSheet();

    await within(dialog).findByRole("button", { name: "Criar aviso" });
    expect(within(dialog).getByRole("radio", { name: /26$/ }).getAttribute("aria-checked")).toBe(
      "true",
    );
    expect(within(dialog).getByRole("radio", { name: "Hoje" }).getAttribute("aria-checked")).toBe(
      "false",
    );
    expect(within(dialog).getByRole("textbox", { name: /Passa por/ })).toHaveProperty(
      "value",
      "incra",
    );
    expect(
      within(dialog).getByRole("switch", { name: "A partir de" }).getAttribute("aria-checked"),
    ).toBe("true");
    const from = within(dialog).getByRole("group", { name: "A partir de" });
    expect(within(from).getByLabelText("Hora")).toHaveProperty("value", "18");
    expect(within(from).getByLabelText("Minutos")).toHaveProperty("value", "00");
    expect(within(dialog).getByRole("switch", { name: "Até" }).getAttribute("aria-checked")).toBe(
      "false",
    );
    expect(within(dialog).queryByRole("group", { name: "Até" })).toBeNull();
  });

  it("limits the text to 80 characters", async () => {
    signedIn();

    const dialog = await openSheet();

    const field = await within(dialog).findByRole("textbox", { name: /Passa por/ });
    expect(field.getAttribute("maxlength")).toBe("80");
  });

  it("shows the clock of the end when it is turned on", async () => {
    const user = userEvent.setup();
    signedIn();

    const dialog = await openSheet();
    await user.click(await within(dialog).findByRole("switch", { name: "Até" }));

    const until = within(dialog).getByRole("group", { name: "Até" });
    expect(within(until).getByLabelText("Hora")).toHaveProperty("value", "19");
  });

  it("asks for push before any request, then creates the alert and says what the device does", async () => {
    const user = userEvent.setup();
    signedIn();
    let sentWhenAsked = -1;
    let finish: () => void = () => undefined;
    pushState.current = fakePush({
      error: UNAVAILABLE,
      enable: vi.fn(() => {
        sentWhenAsked = api.sentTo("POST", "/api/alerts").length;
        return new Promise<void>((resolve) => {
          finish = resolve;
        });
      }),
    });
    api.answer(201, created);

    const dialog = await openSheet();
    await user.click(await within(dialog).findByRole("button", { name: "Criar aviso" }));

    expect(pushState.current.enable).toHaveBeenCalledOnce();
    expect(sentWhenAsked).toBe(0);
    expect(api.sentTo("POST", "/api/alerts")).toHaveLength(0);
    finish();

    expect(await screen.findByText("Aviso criado.")).toBeDefined();
    expect(api.sentTo("POST", "/api/alerts")[0]?.body).toEqual({
      day: "2026-09-26",
      text: "incra",
      from_time: "18:00",
      until_time: null,
    });
    expect(
      screen.getByText(
        "Quando entrar no mural uma carona com vaga que combine, a notificação chega aos aparelhos em que você ligou as notificações.",
      ),
    ).toBeDefined();
    expect(screen.getByText(UNAVAILABLE)).toBeDefined();
    expect(screen.getByRole("button", { name: "Ativar notificações" })).toBeDefined();
    expect(screen.queryByRole("button", { name: "Criar aviso" })).toBeNull();
  });

  it("sends the end of the window when it is on, and closes with Pronto", async () => {
    const user = userEvent.setup();
    const onClosed = vi.fn();
    signedIn();
    api.answer(201, { ...created, until_time: "19:00:00" });

    const dialog = await openSheet(onClosed);
    await user.click(await within(dialog).findByRole("switch", { name: "Até" }));
    await user.click(within(dialog).getByRole("button", { name: "Criar aviso" }));

    await screen.findByText("Aviso criado.");
    expect(api.sentTo("POST", "/api/alerts")[0]?.body).toMatchObject({ until_time: "19:00" });
    await user.click(screen.getByRole("button", { name: "Pronto" }));
    expect(onClosed).toHaveBeenCalledOnce();
  });

  it("shows the API's sentence for a refusal and keeps the form", async () => {
    const user = userEvent.setup();
    signedIn();
    api.answer(422, { detail: "Esse dia já passou." });

    const dialog = await openSheet();
    await user.click(await within(dialog).findByRole("button", { name: "Criar aviso" }));

    const notice = await within(dialog).findByRole("alert");
    expect(notice.textContent).toBe("Esse dia já passou.");
    expect(within(dialog).getByRole("textbox", { name: /Passa por/ })).toBeDefined();
    expect(within(dialog).getByRole("button", { name: "Criar aviso" })).toBeDefined();
  });

  it("says nothing answered when the failure is not the API's sentence", async () => {
    const user = userEvent.setup();
    signedIn();
    api.dropConnection();

    const dialog = await openSheet();
    await user.click(await within(dialog).findByRole("button", { name: "Criar aviso" }));

    expect((await within(dialog).findByRole("alert")).textContent).toBe(
      "Sem resposta do serviço. Tente de novo.",
    );
  });

  it("turns a held refusal into the notice with the way to the account", async () => {
    const user = userEvent.setup();
    signedIn();
    api.answer(403, {
      detail: "Confirme seu e-mail para continuar.",
      required_action: "confirm_email",
    });

    const dialog = await openSheet();
    await user.click(await within(dialog).findByRole("button", { name: "Criar aviso" }));

    const notice = await within(dialog).findByRole("alert");
    expect(notice.textContent).toContain("Confirme seu e-mail para continuar.");
    expect(within(dialog).getByRole("link", { name: "Ir para minha conta" })).toBeDefined();
    expect(within(dialog).getByRole("textbox", { name: /Passa por/ })).toBeDefined();
  });

  it("warns before creating when the device will not receive", async () => {
    signedIn();
    pushState.current = fakePush({ permission: "unsupported" });

    const dialog = await openSheet();

    expect(
      await within(dialog).findByText("Este navegador não recebe notificações."),
    ).toBeDefined();
  });

  it("is used by keyboard alone: Tab reaches Criar aviso and Enter sends", async () => {
    const user = userEvent.setup();
    signedIn();
    api.answer(201, created);

    const dialog = await openSheet();
    const submit = await within(dialog).findByRole("button", { name: "Criar aviso" });
    for (let step = 0; step < 40 && document.activeElement !== submit; step += 1) {
      await user.tab();
    }
    expect(document.activeElement).toBe(submit);
    await user.keyboard("{Enter}");

    expect(await screen.findByText("Aviso criado.")).toBeDefined();
    expect(api.sentTo("POST", "/api/alerts")).toHaveLength(1);
  });

  it("closes with Esc and with Cancelar, sending nothing", async () => {
    const user = userEvent.setup();
    const onClosed = vi.fn();
    signedIn();

    const dialog = await openSheet(onClosed);
    await within(dialog).findByRole("button", { name: "Criar aviso" });
    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(onClosed).toHaveBeenCalledOnce();
    });

    expect(api.sentTo("POST", "/api/alerts")).toHaveLength(0);
  });

  it("closes with Cancelar", async () => {
    const user = userEvent.setup();
    const onClosed = vi.fn();
    signedIn();

    const dialog = await openSheet(onClosed);
    await user.click(await within(dialog).findByRole("button", { name: "Cancelar" }));

    expect(onClosed).toHaveBeenCalledOnce();
    expect(api.sentTo("POST", "/api/alerts")).toHaveLength(0);
  });
});
