// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { DateTimeField } from "./date-time-field";

/** Thursday, 24 September 2026, 14:52 local. */
const now = new Date("2026-09-24T14:52:00");
const at = (local: string) => new Date(local).toISOString();

function Harness({
  initial = at("2026-09-24T19:00:00"),
  dayLocked = false,
  onChange = vi.fn(),
}: {
  initial?: string;
  dayLocked?: boolean;
  onChange?: (value: string) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <DateTimeField
      label="Saída"
      value={value}
      now={now}
      dayLocked={dayLocked}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

describe("DateTimeField, as a person uses it", () => {
  it("shows the day and the hour, each a button that says what it holds", () => {
    render(<Harness />);
    expect(
      screen.getByRole("button", { name: "Dia: Qui, 24 set. Toque para trocar" }),
    ).toBeDefined();
    expect(screen.getByRole("button", { name: "Hora: 19:00. Toque para trocar" })).toBeDefined();
    expect(screen.getByLabelText("Saída")).toBeDefined();
  });

  it("changes the day on a card and the hour by typing, then says it in a sentence", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: /^Dia:/ }));
    const sheet = screen.getByRole("dialog", { name: "Quando você sai?" });
    await user.click(within(sheet).getByRole("button", { name: /^Amanhã/ }));
    await user.click(within(sheet).getByLabelText("Hora"));
    await user.keyboard("0745");

    expect(within(sheet).getByText("amanhã")).toBeDefined();
    expect(within(sheet).getByText("07:45")).toBeDefined();
    await user.click(within(sheet).getByRole("button", { name: "Pronto" }));

    expect(onChange).toHaveBeenLastCalledWith(at("2026-09-25T07:45:00"));
    expect(screen.getByRole("button", { name: "Hora: 07:45. Toque para trocar" })).toBeDefined();
  });

  it("reaches any day through the calendar, and fades the days already gone", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: /^Dia:/ }));
    const sheet = screen.getByRole("dialog");
    await user.click(within(sheet).getByRole("button", { name: "Outro dia" }));
    const month = within(sheet).getByRole("grid", { name: "Setembro de 2026" });
    expect(within(month).getByRole("button", { name: "23" })).toHaveProperty("disabled", true);

    await user.click(within(month).getByRole("button", { name: "30" }));
    await user.click(within(sheet).getByRole("button", { name: "Pronto" }));
    expect(onChange).toHaveBeenLastCalledWith(at("2026-09-30T19:00:00"));
  });

  it("goes to next month from the calendar", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: /^Dia:/ }));
    const sheet = screen.getByRole("dialog");
    await user.click(within(sheet).getByRole("button", { name: "Outro dia" }));
    await user.click(within(sheet).getByRole("button", { name: "Próximo mês" }));
    expect(within(sheet).getByRole("grid", { name: "Outubro de 2026" })).toBeDefined();
  });

  it("warns at once about a time already gone today, and will not take it", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: /^Hora:/ }));
    const sheet = screen.getByRole("dialog");
    await user.click(within(sheet).getByLabelText("Hora"));
    await user.keyboard("1430");

    expect(within(sheet).getByRole("alert").textContent).toContain("Esse horário já passou");
    expect(within(sheet).getByRole("button", { name: "Pronto" })).toHaveProperty("disabled", true);
    expect(within(sheet).getByRole("button", { name: "05:30" })).toHaveProperty("disabled", true);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("on an edit keeps the day and says why, before any refusal", async () => {
    const user = userEvent.setup();
    render(<Harness dayLocked />);

    expect(screen.getByRole("button", { name: "Dia: Qui, 24 set. Só muda a hora" })).toBeDefined();
    await user.click(screen.getByRole("button", { name: /^Dia:/ }));
    const sheet = screen.getByRole("dialog", { name: "Novo horário" });
    expect(within(sheet).getByRole("button", { name: /^Amanhã/ })).toHaveProperty("disabled", true);
    expect(within(sheet).getByRole("button", { name: "Outro dia" })).toHaveProperty(
      "disabled",
      true,
    );
    expect(within(sheet).getByText(/Para outro dia, use Repetir/)).toBeDefined();
  });

  it("closes on Escape and on the close button without changing anything", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: /^Dia:/ }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: /^Amanhã/ }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();

    await user.click(screen.getByRole("button", { name: /^Hora:/ }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Fechar" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });
});
