// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { renderRouted } from "@/shared/testing/render-routed";

import { ActionLink } from "./action-link";
import { Icon } from "./icon";

describe("ActionLink", () => {
  it("is a real anchor, styled like the button of the same emphasis", async () => {
    renderRouted(
      <ActionLink to="/conta" emphasis="primary" icon={<Icon name="mail" size={16} />}>
        Pedir outro link
      </ActionLink>,
    );

    const link = await screen.findByRole("link", { name: "Pedir outro link" });
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("href")).toBe("/conta");
    expect(link.className).toContain("bg-brand");
  });

  it("is reachable by keyboard, like any other link on the page", async () => {
    const user = userEvent.setup();
    renderRouted(
      <ActionLink to="/conta" emphasis="outline">
        Ir para minha conta
      </ActionLink>,
    );
    const link = await screen.findByRole("link", { name: "Ir para minha conta" });

    await user.tab();

    expect(document.activeElement).toBe(link);
  });
});
