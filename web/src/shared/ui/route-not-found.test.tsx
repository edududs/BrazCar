// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderRouted } from "@/shared/testing/render-routed";

import { RouteNotFound } from "./route-not-found";

describe("RouteNotFound", () => {
  it("says so in Portuguese and offers a way back to the board", async () => {
    renderRouted(<RouteNotFound />);

    expect(
      await screen.findByRole("heading", { name: "Página não encontrada", level: 1 }),
    ).toBeDefined();
    expect(screen.getByText("Este endereço não existe no BrazCar.")).toBeDefined();
    const back = screen.getByRole("link", { name: "Voltar ao mural" });
    expect(back.getAttribute("href")).toBe("/");
  });
});
