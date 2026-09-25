// @vitest-environment jsdom
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderRouted } from "@/shared/testing/render-routed";

import * as gateway from "../adapters/feedback-gateway";
import { FeedbackRequestError } from "../domain/feedback";
import { FeedbackSheet, RECEIVED } from "./feedback-sheet";

vi.mock("../adapters/feedback-gateway");
const mocked = vi.mocked(gateway);

function Opened() {
  const [open, setOpen] = useState(true);
  return <FeedbackSheet open={open} onOpenChange={setOpen} />;
}

function show() {
  renderRouted(<Opened />);
  return screen.findByRole("dialog", { name: "Enviar opinião" });
}

describe("FeedbackSheet, as a person uses it", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("types a suggestion key by key, counts it, and thanks once it is received", async () => {
    const user = userEvent.setup();
    mocked.sendFeedback.mockResolvedValue();
    const sheet = await show();

    expect(
      within(sheet).getByRole("radio", { name: "Sugestão" }).getAttribute("aria-checked"),
    ).toBe("true");
    expect(within(sheet).queryByLabelText("É sobre alguém específico")).toBeNull();
    await user.click(within(sheet).getByLabelText(/^Sua opinião/));
    await user.keyboard("Filtro por Pix");
    expect(within(sheet).getByText("14/1000")).toBeDefined();
    await user.click(within(sheet).getByRole("button", { name: "Enviar opinião" }));

    await waitFor(() => {
      expect(mocked.sendFeedback).toHaveBeenCalledWith({
        kind: "suggestion",
        message: "Filtro por Pix",
        aboutPhone: null,
      });
    });
    expect(await screen.findByText(RECEIVED)).toBeDefined();
  });

  it("an empty opinion is marked, and nothing leaves", async () => {
    const user = userEvent.setup();
    const sheet = await show();

    await user.click(within(sheet).getByRole("button", { name: "Enviar opinião" }));

    expect(await within(sheet).findByText("Escreva sua opinião.")).toBeDefined();
    expect(mocked.sendFeedback).not.toHaveBeenCalled();
  });

  it("a complaint names someone by phone, reached with the keyboard", async () => {
    const user = userEvent.setup();
    mocked.sendFeedback.mockResolvedValue();
    const sheet = await show();

    // Into the rail and one step right: Reclamação.
    await user.click(within(sheet).getByRole("radio", { name: "Sugestão" }));
    await user.keyboard("{ArrowRight}");
    expect(
      within(sheet).getByRole("radio", { name: "Reclamação" }).getAttribute("aria-checked"),
    ).toBe("true");
    await user.click(within(sheet).getByLabelText(/^Sua opinião/));
    await user.keyboard("Não apareceu.");
    await user.tab();
    expect(document.activeElement).toBe(within(sheet).getByLabelText("É sobre alguém específico"));
    await user.keyboard(" ");
    await user.click(within(sheet).getByLabelText(/^Celular de quem é/));
    await user.keyboard("61999990002");
    expect(within(sheet).getByLabelText<HTMLInputElement>(/^Celular de quem é/).value).toBe(
      "(61) 99999-0002",
    );
    await user.click(within(sheet).getByRole("button", { name: "Enviar opinião" }));

    await waitFor(() => {
      expect(mocked.sendFeedback).toHaveBeenCalledWith({
        kind: "complaint",
        message: "Não apareceu.",
        aboutPhone: "+5561999990002",
      });
    });
  });

  it("an unfinished phone keeps the sheet open with the same hint as the sign-up", async () => {
    const user = userEvent.setup();
    const sheet = await show();

    await user.click(within(sheet).getByRole("radio", { name: "Reclamação" }));
    await user.click(within(sheet).getByLabelText(/^Sua opinião/));
    await user.keyboard("Algo.");
    await user.click(within(sheet).getByLabelText("É sobre alguém específico"));
    await user.click(within(sheet).getByLabelText(/^Celular de quem é/));
    await user.keyboard("6199");
    await user.click(within(sheet).getByRole("button", { name: "Enviar opinião" }));

    expect(
      await within(sheet).findByText("Digite o celular com DDD, como (61) 99999-9999."),
    ).toBeDefined();
    expect(mocked.sendFeedback).not.toHaveBeenCalled();
  });

  it("what the API refuses is said in the sheet, which stays open", async () => {
    const user = userEvent.setup();
    mocked.sendFeedback.mockRejectedValue(
      new FeedbackRequestError(429, "muitas opiniões por hoje; tente amanhã"),
    );
    const sheet = await show();

    await user.click(within(sheet).getByLabelText(/^Sua opinião/));
    await user.keyboard("Mais uma.");
    await user.click(within(sheet).getByRole("button", { name: "Enviar opinião" }));

    expect(await within(sheet).findByText("muitas opiniões por hoje; tente amanhã")).toBeDefined();
    expect(screen.queryByText(RECEIVED)).toBeNull();
  });
});
