// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderRouted } from "@/shared/testing/render-routed";

import { searchPlaces } from "../adapters/places-gateway";
import type { Place } from "../domain/place";
import { type PlaceChoice, PlacePicker } from "./place-picker";

vi.mock("../adapters/places-gateway");

const place = (id: string, name: string): Place => ({
  id,
  name,
  kind: "area",
  aliases: [],
  parentId: null,
});
const esplanada = place("esplanada", "Esplanada");
const estrutural = place("estrutural", "Estrutural");

beforeEach(() => {
  vi.mocked(searchPlaces).mockImplementation((query) =>
    Promise.resolve(
      [esplanada, estrutural].filter((each) =>
        each.name.toLowerCase().startsWith(query.toLowerCase()),
      ),
    ),
  );
});

function Harness() {
  const [choice, setChoice] = useState<PlaceChoice>({ place: null, text: "" });
  return (
    <>
      <PlacePicker label="Vai para" value={choice} onChange={setChoice} />
      <output aria-label="Escolha">
        {choice.place === null ? `texto:${choice.text}` : `lugar:${choice.place.id}`}
      </output>
    </>
  );
}

// Read from the DOM, not by role: in jsdom the list's closing animation never ends, so Base UI
// keeps the rest of the page out of the accessibility tree a moment longer than a browser does.
const choice = () => document.querySelector('output[aria-label="Escolha"]')?.textContent;

describe("PlacePicker, as a person uses it", () => {
  it("finds places while typing and takes one by tap", async () => {
    const user = userEvent.setup();
    renderRouted(<Harness />);

    await user.click(await screen.findByLabelText("Vai para"));
    await user.keyboard("Es");
    await user.click(await screen.findByRole("option", { name: "Esplanada" }));

    expect(choice()).toBe("lugar:esplanada");
    expect(screen.getByLabelText("Vai para")).toHaveProperty("value", "Esplanada");
  });

  it("takes one from the keyboard alone: arrows through the list, Enter to choose", async () => {
    const user = userEvent.setup();
    renderRouted(<Harness />);

    await user.click(await screen.findByLabelText("Vai para"));
    await user.keyboard("Es");
    await screen.findByRole("option", { name: "Estrutural" });
    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");

    await waitFor(() => {
      expect(choice()).toBe("lugar:estrutural");
    });
  });

  it("keeps what was typed as the stop itself when nothing in the catalogue matches (D-123)", async () => {
    const user = userEvent.setup();
    renderRouted(<Harness />);

    await user.click(await screen.findByLabelText("Vai para"));
    await user.keyboard("Portão da escola");
    expect(await screen.findByText(/vale como você escreveu/)).toBeDefined();
    // Leaving the field by the keyboard. Leaving it by a tap elsewhere is proved in the real
    // browser by the end to end suite (driver.spec, "uma parada em texto livre").
    await user.tab();

    expect(choice()).toBe("texto:Portão da escola");
    expect(screen.getByLabelText<HTMLInputElement>("Vai para").value).toBe("Portão da escola");
  });
});
