// @vitest-environment jsdom
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Car } from "@/features/accounts/domain/account";
import { fetchPlace, searchPlaces } from "@/features/places/adapters/places-gateway";
import { renderRouted } from "@/shared/testing/render-routed";

import type { RideDraft } from "../domain/ride";
import { RideForm } from "./ride-form";

vi.mock("@/features/places/adapters/places-gateway");

beforeEach(() => {
  vi.mocked(searchPlaces).mockResolvedValue([]);
  vi.mocked(fetchPlace).mockResolvedValue(null);
});

/** Thursday, 24 September 2026, 14:52 local. */
const now = new Date("2026-09-24T14:52:00");
const car: Car = { id: "c1", model: "Gol", color: "prata", plate: "ABC1234" };
const blank: RideDraft = {
  carId: "c1",
  stops: [
    { placeId: null, text: "Brazlândia", fare: "" },
    { placeId: null, text: "Esplanada", fare: "" },
  ],
  departureAt: new Date("2026-09-24T15:00:00").toISOString(),
  seatsAvailable: 3,
  price: "7.00",
  paymentMethods: ["pix", "cash"],
  notes: "",
};

function show(onSubmit = vi.fn(() => Promise.resolve())) {
  renderRouted(
    <RideForm
      initial={blank}
      cars={[car]}
      busy={false}
      now={now}
      submitLabel="Publicar carona"
      onSubmit={onSubmit}
    />,
  );
  return onSubmit;
}

const sent = (onSubmit: ReturnType<typeof vi.fn>) =>
  (onSubmit.mock.calls.at(-1) as [RideDraft] | undefined)?.[0];

describe("RideForm, as a driver uses it", () => {
  it("publishes with the departure typed on the sheet, not only by the arrows", async () => {
    const user = userEvent.setup();
    const onSubmit = show();

    await user.click(await screen.findByRole("button", { name: /^Hora:/ }));
    const sheet = screen.getByRole("dialog", { name: "Quando você sai?" });
    await user.click(within(sheet).getByLabelText("Hora"));
    await user.keyboard("1930");
    await user.click(within(sheet).getByRole("button", { name: "Pronto" }));
    await user.click(screen.getByRole("button", { name: "Publicar carona" }));

    await waitFor(() => {
      expect(sent(onSubmit)?.departureAt).toBe(new Date("2026-09-24T19:30:00").toISOString());
    });
  });

  it("adds a stop, prices every stop behind the switch, and says what the board will show", async () => {
    const user = userEvent.setup();
    const onSubmit = show();

    await user.click(await screen.findByRole("button", { name: "Adicionar parada no caminho" }));
    await user.click(screen.getByRole("switch", { name: "Preço diferente por parada" }));
    const [firstFare, lastFare, ...others] = screen.getAllByLabelText("Preço até aqui");
    if (firstFare === undefined || lastFare === undefined) throw new Error("two fares expected");
    expect(others).toHaveLength(0);
    expect(screen.queryByLabelText("Preço")).toBeNull();

    await user.click(firstFare);
    await user.keyboard("6");
    await user.click(lastFare);
    await user.keyboard("12");
    expect(screen.getByText("R$ 6,00")).toBeDefined();

    await user.click(screen.getByRole("button", { name: "Publicar carona" }));
    await waitFor(() => {
      expect(sent(onSubmit)?.stops.map((stop) => stop.fare)).toEqual(["", "6", "12"]);
    });
  });

  it("drops the fares typed if the switch is turned off again, so the ride's price counts", async () => {
    const user = userEvent.setup();
    const onSubmit = show();

    await user.click(await screen.findByRole("switch", { name: "Preço diferente por parada" }));
    await user.click(screen.getByLabelText("Preço até aqui"));
    await user.keyboard("9");
    await user.click(screen.getByRole("switch", { name: "Preço diferente por parada" }));
    await user.click(screen.getByRole("button", { name: "Publicar carona" }));

    await waitFor(() => {
      expect(sent(onSubmit)?.stops.map((stop) => stop.fare)).toEqual(["", ""]);
    });
  });

  it("changes the seats on the stepper and the payment on the toggles", async () => {
    const user = userEvent.setup();
    const onSubmit = show();

    await user.click(await screen.findByRole("button", { name: "Pôr uma vaga" }));
    await user.click(
      within(screen.getByRole("group", { name: "Pagamento" })).getByRole("button", {
        name: "dinheiro",
      }),
    );
    await user.click(screen.getByRole("button", { name: "Publicar carona" }));

    await waitFor(() => {
      expect(sent(onSubmit)).toMatchObject({ seatsAvailable: 4, paymentMethods: ["pix"] });
    });
  });

  it("counts the notes while typing and sends them with the line breaks", async () => {
    const user = userEvent.setup();
    const onSubmit = show();

    await user.click(await screen.findByLabelText(/^Observações/));
    await user.keyboard("Levo mala{Enter}pequena");
    expect(screen.getByText("17/500")).toBeDefined();
    await user.click(screen.getByRole("button", { name: "Publicar carona" }));

    await waitFor(() => {
      expect(sent(onSubmit)?.notes).toBe("Levo mala\npequena");
    });
  });

  it("keeps the fixed button part of the form, so Enter in a field submits it in a browser", async () => {
    show();
    const button = await screen.findByRole("button", { name: "Publicar carona" });
    // The button lives on the bar outside the <form>, tied to it by the `form` attribute; the
    // browser's implicit submission follows the form owner. user-event only looks inside the
    // form, so the association itself is what this test proves.
    const form = (button as HTMLButtonElement).form;
    expect(form).not.toBeNull();
    expect(form?.contains(screen.getByLabelText("Preço"))).toBe(true);
    expect(button.getAttribute("type")).toBe("submit");
  });
});
