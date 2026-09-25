// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { type BoardFilters, noFilters } from "../domain/board";
import { BoardFiltersForm } from "./board-filters";

/** Thursday, 24 September 2026, 14:52 local. */
const now = new Date("2026-09-24T14:52:00");

function Harness() {
  const [filters, setFilters] = useState<BoardFilters>(noFilters);
  return (
    <>
      <BoardFiltersForm filters={filters} onChange={setFilters} now={now} />
      <output aria-label="Filtros">{JSON.stringify(filters)}</output>
    </>
  );
}

const applied = () =>
  JSON.parse(screen.getByRole("status", { name: "Filtros" }).textContent) as BoardFilters;

describe("the board's filters, as a person uses them", () => {
  it("sets 'A partir de' by typing the hour on the sheet, and the chip then says it", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "A partir de" }));
    const sheet = screen.getByRole("dialog", { name: "A partir de que horas?" });
    await user.click(within(sheet).getByLabelText("Hora"));
    await user.keyboard("1830");
    await user.click(within(sheet).getByRole("button", { name: "Mostrar caronas" }));

    expect(applied().fromTime).toBe("18:30");
    expect(screen.getByRole("button", { name: "A partir de 18:30", pressed: true })).toBeDefined();
  });

  it("offers 'Agora' and the usual times as one tap each", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "A partir de" }));
    const sheet = screen.getByRole("dialog");
    await user.click(within(sheet).getByRole("button", { name: "Agora" }));
    await user.click(within(sheet).getByRole("button", { name: "Mostrar caronas" }));
    expect(applied().fromTime).toBe("14:52");
  });

  it("clears the time with the chip's second tap, and from the sheet's 'Limpar'", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "A partir de" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "18:00" }));
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Mostrar caronas" }),
    );
    await user.click(screen.getByRole("button", { name: "A partir de 18:00" }));
    expect(applied().fromTime).toBeNull();

    await user.click(screen.getByRole("button", { name: "A partir de" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Limpar" }));
    expect(applied().fromTime).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("sets the most one pays by typing it on the price sheet", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "Até R$" }));
    const sheet = screen.getByRole("dialog", { name: "Até quanto?" });
    await user.click(within(sheet).getByLabelText("Preço até"));
    await user.keyboard("8");
    await user.click(within(sheet).getByRole("button", { name: "Mostrar caronas" }));
    expect(applied().maxPrice).toBe("8");
    expect(screen.getByRole("button", { name: "Até R$ 8", pressed: true })).toBeDefined();
  });

  it("types the search and keeps what the other chips set", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "Amanhã" }));
    await user.click(screen.getByLabelText("Passa por"));
    await user.keyboard("Esplanada");
    expect(applied()).toMatchObject({ day: "2026-09-25", text: "Esplanada" });
  });

  it("closes a sheet on Escape without applying anything", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "A partir de" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "19:00" }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(applied().fromTime).toBeNull();
  });
});
