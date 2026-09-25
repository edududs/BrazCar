// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { useTimeDraft } from "../app/use-time-draft";
import { ClockPicker } from "./clock-picker";

/** The picker with its draft, and the clock it holds written out, as a screen would use it. */
function Harness({ initial = "18:00", step = 5 }: { initial?: string; step?: number }) {
  const draft = useTimeDraft(initial, step);
  return (
    <>
      <ClockPicker draft={draft} minuteStep={step} />
      <output aria-label="Escolhido">{draft.value}</output>
    </>
  );
}

const chosen = () => screen.getByRole("status", { name: "Escolhido" }).textContent;

describe("ClockPicker, as a person uses it", () => {
  it("takes an hour typed digit by digit, then the minutes, without touching the arrows", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByLabelText("Hora"));
    await user.keyboard("19");
    expect(chosen()).toBe("19:00");
    // Two digits fill the hour: the minutes take the focus, so the typing just goes on.
    expect(screen.getByLabelText("Minutos")).toHaveProperty(
      "ownerDocument.activeElement",
      screen.getByLabelText("Minutos"),
    );

    await user.keyboard("07");
    expect(chosen()).toBe("19:07");
  });

  it("types one digit and keeps it, instead of turning it into a padded number mid-typing", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByLabelText("Hora"));
    await user.keyboard("7");
    expect(screen.getByLabelText("Hora")).toHaveProperty("value", "7");
    expect(chosen()).toBe("07:00");

    await user.tab();
    expect(screen.getByLabelText("Hora")).toHaveProperty("value", "07");
  });

  it("shows the current value as a hint while the field is emptied for typing", async () => {
    const user = userEvent.setup();
    render(<Harness initial="18:30" />);

    await user.click(screen.getByLabelText("Minutos"));
    const minutes = screen.getByLabelText("Minutos");
    expect(minutes).toHaveProperty("value", "");
    expect(minutes.getAttribute("placeholder")).toBe("30");

    await user.tab();
    expect(minutes).toHaveProperty("value", "30");
    expect(chosen()).toBe("18:30");
  });

  it("refuses an hour that does not exist, says so, and keeps the last good one", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByLabelText("Hora"));
    await user.keyboard("2");
    await user.keyboard("5");
    expect(screen.getByLabelText("Hora").getAttribute("aria-invalid")).toBe("true");
    expect(chosen()).toBe("02:00");

    await user.tab();
    expect(screen.getByLabelText("Hora")).toHaveProperty("value", "02");
    expect(screen.getByLabelText("Hora").hasAttribute("aria-invalid")).toBe(false);
  });

  it("ignores letters typed by mistake", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByLabelText("Hora"));
    await user.keyboard("1h9");
    expect(chosen()).toBe("19:00");
  });

  it("still moves by the arrows, around the day and on the minute grid", async () => {
    const user = userEvent.setup();
    render(<Harness initial="23:55" />);

    await user.click(screen.getByRole("button", { name: "5 minutos a mais" }));
    expect(chosen()).toBe("00:00");
    await user.click(screen.getByRole("button", { name: "Uma hora a menos" }));
    expect(chosen()).toBe("23:00");
  });

  it("works from the keyboard alone: Tab reaches every part, Enter presses a button", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Uma hora a mais" }));
    await user.keyboard("{Enter}");
    expect(chosen()).toBe("19:00");
    await user.tab();
    expect(document.activeElement).toBe(screen.getByLabelText("Hora"));
  });
});
