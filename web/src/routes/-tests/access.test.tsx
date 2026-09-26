// @vitest-environment jsdom
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { installFakeEventSource } from "@/shared/testing/fake-event-source";
import { renderApp } from "@/shared/testing/render-app";

import { driverOut, serveShell } from "./fixtures";

// The real adapter imports vite-plugin-pwa's virtual module, which Vitest cannot resolve; the
// shell mounts it on every route, so any test rendering the whole app needs this double (D-106).
vi.mock("@/shared/adapters/service-worker", () => ({
  applyUpdate: vi.fn(() => Promise.resolve()),
  readUpdateWaiting: () => false,
  subscribeToUpdateWaiting: () => () => undefined,
}));

const api = await vi.hoisted(async () => {
  const { installFakeApi } = await import("@/shared/testing/fake-api");
  return installFakeApi();
});

beforeEach(() => {
  api.reset();
  installFakeEventSource();
  serveShell(api, null);
  api.serve("GET", "/api/rides", 200, []);
  api.serve("GET", "/api/places", 200, []);
});

describe("/entrar", () => {
  it("signs in and lands on the board, where the last tab becomes 'Conta'", async () => {
    const user = userEvent.setup();
    api.serve("POST", "/api/accounts/login", 200, driverOut);
    const { router } = await renderApp("/entrar");

    await user.type(await screen.findByLabelText(/^Celular/), "61999990001");
    await user.type(screen.getByLabelText(/^Senha/), "segredo123{Enter}");

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/");
    });
    expect(await screen.findByRole("link", { name: "Conta" })).toBeDefined();
    expect(api.sentTo("POST", "/api/accounts/login")[0]?.body).toEqual({
      phone: "+5561999990001",
      password: "segredo123",
    });
  });

  it("stacks over the board: a way back and no tabs", async () => {
    await renderApp("/entrar");

    expect(
      (await screen.findByRole("link", { name: "Voltar ao mural" })).getAttribute("href"),
    ).toBe("/");
    expect(screen.queryByRole("navigation", { name: "Principal" })).toBeNull();
    // No self-serve way in: signing up is invite-only (D-167).
    expect(screen.queryByRole("link", { name: "Criar conta" })).toBeNull();
  });
});

describe("/cadastro", () => {
  it("without a token, says signing up is invite-only and shows no form", async () => {
    await renderApp("/cadastro");

    expect(await screen.findByText("Só por convite")).toBeDefined();
    expect(screen.queryByLabelText(/^Nome/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Criar conta" })).toBeNull();
  });

  it("a spent or lapsed link says so, in the API's own words", async () => {
    api.serve("GET", "/api/accounts/signup/old", 410, {
      detail: "Link vencido. Peça um convite novo.",
    });

    await renderApp("/cadastro?token=old");

    expect(await screen.findByText("Link vencido. Peça um convite novo.")).toBeDefined();
    expect(screen.queryByLabelText(/^Nome/)).toBeNull();
  });

  it("with the invite's link, shows the phone masked and the e-mail fixed, and registers", async () => {
    const user = userEvent.setup();
    api.serve("GET", "/api/accounts/signup/tok-1", 200, {
      phone_masked: "+5561*****0001",
      email: "ana@example.com",
      email_expires_at: "2026-09-01T12:00:00-03:00",
    });
    api.serve("POST", "/api/accounts/register", 201, driverOut);
    const { router } = await renderApp("/cadastro?token=tok-1");

    expect((await screen.findByLabelText<HTMLInputElement>("Celular")).value).toBe(
      "+5561*****0001",
    );
    expect(screen.getByLabelText<HTMLInputElement>(/^E-mail/).value).toBe("ana@example.com");
    await user.type(screen.getByLabelText(/^Nome/), "Ana Souza");
    await user.type(screen.getByLabelText(/^Senha/), "uma-senha-boa");
    await user.click(screen.getByLabelText(/Li e aceito os termos/));
    await user.click(screen.getByRole("button", { name: "Criar conta" }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/");
    });
    expect(api.sentTo("POST", "/api/accounts/register")[0]?.body).toEqual({
      email_token: "tok-1",
      display_name: "Ana Souza",
      password: "uma-senha-boa",
      accepts_terms: true,
    });
  });
});

describe("/esqueci-senha", () => {
  it("asks for the link and answers the same for any number", async () => {
    const user = userEvent.setup();
    api.serve("POST", "/api/accounts/password-reset", 200, { ok: true });
    await renderApp("/esqueci-senha");

    await user.type(await screen.findByLabelText(/^Celular/), "61999990009{Enter}");

    expect(await screen.findByText("Confira seu e-mail")).toBeDefined();
  });
});

describe("/redefinir-senha", () => {
  it("without the code in the link, asks for another link instead of a form", async () => {
    await renderApp("/redefinir-senha");

    expect(await screen.findByText("Este link está incompleto")).toBeDefined();
    expect(screen.getByRole("link", { name: "Pedir outro link" }).getAttribute("href")).toBe(
      "/esqueci-senha",
    );
    expect(screen.queryByLabelText(/^Nova senha/)).toBeNull();
  });

  it("with the code, saves the new password with it and goes to sign in", async () => {
    const user = userEvent.setup();
    api.serve("POST", "/api/accounts/password-reset/confirm", 200, { ok: true });
    const { router } = await renderApp("/redefinir-senha?token=tok-1");

    await user.type(await screen.findByLabelText(/^Nova senha/), "nova-senha-boa{Enter}");

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/entrar");
    });
    expect(api.sentTo("POST", "/api/accounts/password-reset/confirm")[0]?.body).toEqual({
      token: "tok-1",
      password: "nova-senha-boa",
    });
  });
});

describe("/conta", () => {
  it("a visitor is invited in, and can still pick the theme and read the version", async () => {
    await renderApp("/conta");

    expect(await screen.findByText("Entre para publicar e pedir contato")).toBeDefined();
    const page = within(screen.getByRole("main"));
    expect(page.getByRole("link", { name: "Entrar" }).getAttribute("href")).toBe("/entrar");
    // No self-serve way in: signing up is invite-only (D-167).
    expect(page.queryByRole("link", { name: "Criar conta" })).toBeNull();
    expect(screen.getByText(/^BrazCar \d+\.\d+\.\d+/)).toBeDefined();
  });

  it("signed in, it shows the account and signing out goes to the board with a notice", async () => {
    const user = userEvent.setup();
    serveShell(api, driverOut);
    api.serve("POST", "/api/accounts/logout", 200, { ok: true });
    const { router } = await renderApp("/conta");

    expect(await screen.findByText("Ana Souza")).toBeDefined();
    await user.click(screen.getByRole("button", { name: /^Sair/ }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/");
    });
    expect(await screen.findByText("Você saiu da conta.")).toBeDefined();
  });

  it("the opinion row opens the feedback sheet", async () => {
    const user = userEvent.setup();
    serveShell(api, driverOut);
    await renderApp("/conta");

    await user.click(await screen.findByRole("button", { name: /Enviar opinião/ }));

    expect(await screen.findByRole("dialog")).toBeDefined();
  });

  it("deleting the account lands on the board saying the account is gone", async () => {
    const user = userEvent.setup();
    serveShell(api, driverOut);
    api.serve("DELETE", "/api/accounts/me", 200, { ok: true });
    const { router } = await renderApp("/conta");

    await user.click(await screen.findByRole("button", { name: "Excluir conta" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Excluir conta" }));

    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ accountDeleted: true });
    });
    expect(
      await screen.findByText("Conta excluída. As caronas dela saíram do mural."),
    ).toBeDefined();
  });
});
