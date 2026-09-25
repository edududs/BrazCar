// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderRouted } from "../testing/render-routed";
import { EmptyState } from "./empty-state";
import { InstallHintCard } from "./install-hint-card";
import { type Tab, TabBar } from "./tab-bar";
import { Toast, ToastAction } from "./toast";

const tabs: readonly Tab[] = [
  { to: "/", label: "Caronas", icon: "board" },
  { to: "/publicar", label: "Publicar", icon: "plus", primary: true },
  { to: "/minhas-caronas", label: "Minhas", icon: "route" },
  { to: "/entrar", label: "Entrar", icon: "user" },
];

describe("TabBar", () => {
  it("is the main navigation, one real link per destination", async () => {
    renderRouted(<TabBar tabs={tabs} />);
    const nav = await screen.findByRole("navigation", { name: "Principal" });
    expect(nav).toBeTruthy();
    expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual([
      "Caronas",
      "Publicar",
      "Minhas",
      "Entrar",
    ]);
    expect(screen.getByRole("link", { name: "Publicar" }).getAttribute("href")).toBe("/publicar");
  });
});

describe("Toast", () => {
  it("is announced as a status and carries its one action", () => {
    const onPress = vi.fn();
    render(
      <Toast action={<ToastAction onPress={onPress}>Atualizar</ToastAction>}>
        Há uma versão nova do BrazCar.
      </Toast>,
    );
    expect(screen.getByRole("status").textContent).toContain("Há uma versão nova do BrazCar.");
    fireEvent.click(screen.getByRole("button", { name: "Atualizar" }));
    expect(onPress).toHaveBeenCalledOnce();
  });

  it("interrupts as an alert when asked to", () => {
    render(<Toast role="alert">Sem internet.</Toast>);
    expect(screen.getByRole("alert").textContent).toContain("Sem internet.");
  });
});

describe("InstallHintCard", () => {
  it("names the two Safari steps and goes away on 'Agora não'", () => {
    const onDismiss = vi.fn();
    render(<InstallHintCard onDismiss={onDismiss} />);
    const card = screen.getByRole("complementary", { name: "Use como app" });
    expect(card.textContent).toContain("Compartilhar");
    expect(card.textContent).toContain("Adicionar à Tela de Início");
    fireEvent.click(screen.getByRole("button", { name: "Agora não" }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});

describe("EmptyState", () => {
  it("is a heading at the level the page needs, with its text and action", () => {
    render(
      <EmptyState as="h1" title="Nada aqui" action={<button type="button">Voltar</button>}>
        Explicação.
      </EmptyState>,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Nada aqui" })).toBeTruthy();
    expect(screen.getByText("Explicação.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Voltar" })).toBeTruthy();
  });
});
