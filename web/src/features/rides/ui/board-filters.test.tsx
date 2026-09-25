// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { noFilters } from "../domain/board";
import { BoardFiltersForm } from "./board-filters";

describe("BoardFiltersForm", () => {
  it("shows 'A partir de' first, ahead of the other filters", () => {
    const { container } = render(
      <BoardFiltersForm filters={noFilters} onChange={() => undefined} />,
    );

    const text = container.textContent;
    const fromTimeAt = text.indexOf("A partir de");
    const passaPorAt = text.indexOf("Passa por");

    expect(fromTimeAt).toBeGreaterThanOrEqual(0);
    expect(fromTimeAt).toBeLessThan(passaPorAt);
  });

  it("sends the typed time (D-141)", () => {
    const onChange = vi.fn();
    render(<BoardFiltersForm filters={noFilters} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText(/^A partir de/), { target: { value: "18:00" } });

    expect(onChange).toHaveBeenCalledWith({ ...noFilters, fromTime: "18:00" });
  });

  it("clearing the time sends null (D-141)", () => {
    const onChange = vi.fn();
    const filters = { ...noFilters, fromTime: "18:00" };
    render(<BoardFiltersForm filters={filters} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText(/^A partir de/), { target: { value: "" } });

    expect(onChange).toHaveBeenCalledWith({ ...filters, fromTime: null });
  });
});
