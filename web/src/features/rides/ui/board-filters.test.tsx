// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BOARD_UTC_OFFSET } from "@/shared/domain/board-time-zone";

import { noFilters } from "../domain/board";
import { BoardFiltersForm } from "./board-filters";

/** Thursday, 24 September 2026, 14:52 on the board's own clock (D-094), not the runner's. */
const now = new Date(`2026-09-24T14:52:00${BOARD_UTC_OFFSET}`);

describe("BoardFiltersForm", () => {
  it("offers 'A partir de' first, then the days, seats and price", () => {
    render(<BoardFiltersForm filters={noFilters} onChange={() => undefined} now={now} />);
    const chips = screen.getAllByRole("button", { pressed: false }).map((chip) => chip.textContent);
    expect(chips).toEqual([
      "A partir de",
      "Hoje",
      "Amanhã",
      "Sáb 26",
      "Dom 27",
      "Com vaga",
      "Até R$",
    ]);
  });

  it("sends the day a chip names, and takes it back on the second press", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <BoardFiltersForm filters={noFilters} onChange={onChange} now={now} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Hoje" }));
    expect(onChange).toHaveBeenCalledWith({ ...noFilters, day: "2026-09-24" });

    rerender(
      <BoardFiltersForm
        filters={{ ...noFilters, day: "2026-09-24" }}
        onChange={onChange}
        now={now}
      />,
    );
    const pressed = screen.getByRole("button", { name: "Hoje", pressed: true });
    fireEvent.click(pressed);
    expect(onChange).toHaveBeenLastCalledWith({ ...noFilters, day: null });
  });

  it("moves an active filter to the front and clears it with an × (D-141)", () => {
    const onChange = vi.fn();
    render(
      <BoardFiltersForm
        filters={{ ...noFilters, fromTime: "18:00", withSeats: true }}
        onChange={onChange}
        now={now}
      />,
    );
    const chips = screen.getAllByRole("button", { pressed: true }).map((chip) => chip.textContent);
    expect(chips).toEqual(["A partir de 18:00", "Com vaga"]);

    fireEvent.click(screen.getByRole("button", { name: "A partir de 18:00" }));
    expect(onChange).toHaveBeenCalledWith({ ...noFilters, fromTime: null, withSeats: true });
  });

  it("sends the typed search text, and null once it is cleared", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <BoardFiltersForm filters={noFilters} onChange={onChange} now={now} />,
    );
    fireEvent.change(screen.getByLabelText("Passa por"), { target: { value: "SCS" } });
    expect(onChange).toHaveBeenCalledWith({ ...noFilters, text: "SCS" });

    rerender(
      <BoardFiltersForm filters={{ ...noFilters, text: "SCS" }} onChange={onChange} now={now} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Limpar busca" }));
    expect(onChange).toHaveBeenLastCalledWith({ ...noFilters, text: null });
  });
});
