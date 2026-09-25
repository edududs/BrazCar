// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Car } from "@/features/accounts/domain/account";
import { fetchPlace, searchPlaces } from "@/features/places/adapters/places-gateway";
import type { Place } from "@/features/places/domain/place";
import { renderRouted } from "@/shared/testing/render-routed";

import type { RideDraft } from "../domain/ride";
import { RideForm } from "./ride-form";

vi.mock("@/features/places/adapters/places-gateway");

const esplanada: Place = {
  id: "esplanada",
  name: "Esplanada",
  kind: "area",
  aliases: [],
  parentId: null,
};

beforeEach(() => {
  vi.mocked(searchPlaces).mockResolvedValue([esplanada]);
  vi.mocked(fetchPlace).mockImplementation((placeId) =>
    Promise.resolve(placeId === esplanada.id ? esplanada : null),
  );
});

const draft: RideDraft = {
  carId: "",
  stops: [
    { placeId: null, text: "Brazlândia", fare: "" },
    { placeId: null, text: "Incra 8", fare: "" },
  ],
  departureAt: "2026-09-23T10:00:00.000Z",
  seatsAvailable: 3,
  price: "7.00",
  paymentMethods: ["pix"],
  notes: "",
};

const car: Car = { id: "c1", model: "Gol", color: "prata", plate: "ABC1234" };
const now = new Date("2026-09-23T06:00:00");

function show(onSubmit: (draft: RideDraft) => Promise<unknown>) {
  return renderRouted(
    <RideForm initial={draft} busy={false} submitLabel="Salvar" onSubmit={onSubmit} now={now} />,
  );
}

describe("RideForm", () => {
  it("caps the seats at four, a passenger car's usual seats (D-142)", async () => {
    renderRouted(
      <RideForm
        initial={draft}
        cars={[car]}
        busy={false}
        submitLabel="Publicar"
        onSubmit={() => Promise.resolve()}
        now={now}
      />,
    );

    const more = await screen.findByRole("button", { name: "Pôr uma vaga" });
    fireEvent.click(more);
    expect(screen.getByRole("status", { name: "Vagas" }).textContent).toBe("4");
    expect(more).toHaveProperty("disabled", true);
  });

  it("counts the notes against the limit and sends them", async () => {
    const onSubmit = vi.fn<(draft: RideDraft) => Promise<unknown>>(() => Promise.resolve());
    show(onSubmit);

    const notes = await screen.findByLabelText(/^Observações/);
    fireEvent.change(notes, { target: { value: "Levo mala" } });

    expect(screen.getByText("9/500")).toBeDefined();
    expect(notes.getAttribute("maxlength")).toBe("500");

    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    expect(onSubmit.mock.calls[0]?.[0].notes).toBe("Levo mala");
  });

  it("asks no fare for the stop the ride leaves from, once fares are switched on", async () => {
    show(() => Promise.resolve());

    await screen.findByLabelText(/^Observações/);
    expect(screen.queryByLabelText("Preço até aqui")).toBeNull();
    fireEvent.click(screen.getByRole("switch", { name: "Preço diferente por parada" }));

    expect(screen.getAllByLabelText("Preço até aqui")).toHaveLength(1);
  });

  it("drops the price field once a stop carries a fare, and sends the fare (D-131)", async () => {
    const onSubmit = vi.fn<(draft: RideDraft) => Promise<unknown>>(() => Promise.resolve());
    show(onSubmit);

    await screen.findByLabelText("Preço");
    fireEvent.click(screen.getByRole("switch", { name: "Preço diferente por parada" }));
    const fare = await screen.findByLabelText("Preço até aqui");
    expect(screen.queryByLabelText("Preço")).toBeNull();

    fireEvent.change(fare, { target: { value: "9.00" } });

    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    expect(onSubmit.mock.calls[0]?.[0].stops.map((stop) => stop.fare)).toEqual(["", "9.00"]);
  });

  it("shows what the API refused", async () => {
    show(() => Promise.reject(new Error("boom")));

    fireEvent.click(await screen.findByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeDefined();
    });
  });
});

describe("StopField, a single field with catalog and free text (D-123)", () => {
  it("shows the free text a stop already has when the ride is opened to edit", async () => {
    show(() => Promise.resolve());

    const origin = await screen.findByLabelText("Sai de");
    expect((origin as HTMLInputElement).value).toBe("Brazlândia");
    const destination = screen.getByLabelText("Vai para");
    expect((destination as HTMLInputElement).value).toBe("Incra 8");
  });

  it("choosing a place from the list gives its id and clears the text", async () => {
    const onSubmit = vi.fn<(draft: RideDraft) => Promise<unknown>>(() => Promise.resolve());
    show(onSubmit);

    const destination = await screen.findByLabelText("Vai para");
    fireEvent.mouseDown(destination);
    fireEvent.change(destination, { target: { value: "Espl" } });
    fireEvent.click(await screen.findByRole("option", { name: "Esplanada" }));

    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    expect(onSubmit.mock.calls[0]?.[0].stops[1]).toEqual({
      placeId: "esplanada",
      text: "",
      fare: "",
    });
  });

  it("typing a place and leaving the field gives free text", async () => {
    const onSubmit = vi.fn<(draft: RideDraft) => Promise<unknown>>(() => Promise.resolve());
    show(onSubmit);

    const destination = await screen.findByLabelText("Vai para");
    fireEvent.change(destination, { target: { value: "Portão da escola, quadra 12" } });
    fireEvent.blur(destination);

    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    expect(onSubmit.mock.calls[0]?.[0].stops[1]).toEqual({
      placeId: null,
      text: "Portão da escola, quadra 12",
      fare: "",
    });
  });

  it("choosing from the list after typing clears the typed text", async () => {
    const onSubmit = vi.fn<(draft: RideDraft) => Promise<unknown>>(() => Promise.resolve());
    show(onSubmit);

    const destination = await screen.findByLabelText("Vai para");
    fireEvent.mouseDown(destination);
    fireEvent.change(destination, { target: { value: "Espl" } });
    fireEvent.click(await screen.findByRole("option", { name: "Esplanada" }));
    fireEvent.blur(destination);

    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    expect(onSubmit.mock.calls[0]?.[0].stops[1]).toEqual({
      placeId: "esplanada",
      text: "",
      fare: "",
    });
  });

  it("tells the driver that unmatched text still counts as the stop", async () => {
    vi.mocked(searchPlaces).mockResolvedValue([]);
    show(() => Promise.resolve());

    const destination = await screen.findByLabelText("Vai para");
    fireEvent.mouseDown(destination);
    fireEvent.change(destination, { target: { value: "Sítio Novo" } });

    await screen.findByText('Nenhum lugar do catálogo com "Sítio Novo"; vale como você escreveu.');
  });
});
