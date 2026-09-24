// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderRouted } from "@/shared/testing/render-routed";

import * as gateway from "../adapters/rides-gateway";
import { RideRequestError } from "../domain/ride";
import { ContactButton } from "./contact-button";

vi.mock("../adapters/rides-gateway");

const mocked = vi.mocked(gateway);

async function askForContact(): Promise<void> {
  renderRouted(<ContactButton rideId="r1" />);
  const button = await screen.findByRole("button", { name: "Pedir contato" });
  fireEvent.click(button);
}

describe("ContactButton", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("shows the plate and the WhatsApp link once the API hands them out", async () => {
    mocked.requestContact.mockResolvedValue({
      whatsappUrl: "https://wa.me/5561999990001?text=Oi",
      plate: "ABC1234",
    });

    await askForContact();

    const link = await screen.findByRole("link", { name: "Falar no WhatsApp" });
    expect(link.getAttribute("href")).toBe("https://wa.me/5561999990001?text=Oi");
    expect(screen.getByText("ABC1234")).toBeDefined();
    expect(mocked.requestContact).toHaveBeenCalledWith("r1");
  });

  it("says there is no plate for a driver the platform only knows by phone", async () => {
    mocked.requestContact.mockResolvedValue({
      whatsappUrl: "https://wa.me/5561999990009?text=Oi",
      plate: null,
    });

    await askForContact();

    await screen.findByRole("link", { name: "Falar no WhatsApp" });
    expect(screen.getByText(/Sem placa cadastrada/)).toBeDefined();
    expect(screen.queryByText(/^Placa/)).toBeNull();
  });

  it("shows the refusal and keeps the button", async () => {
    mocked.requestContact.mockRejectedValue(
      new RideRequestError(429, "muitos pedidos de contato; tente depois"),
    );

    await askForContact();

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toBe("muitos pedidos de contato; tente depois");
    });
    expect(screen.getByRole("button", { name: "Pedir contato" })).toBeDefined();
  });
});
