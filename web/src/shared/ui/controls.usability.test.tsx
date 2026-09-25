// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { Chip } from "./chip";
import { ConfirmDialog } from "./confirm-dialog";
import { Segmented } from "./segmented";
import { Sheet } from "./sheet";
import { Stepper } from "./stepper";
import { SwitchField } from "./switch-field";
import { ToggleField } from "./toggle-field";

/**
 * Usability of the controls, as a person uses them: a tap, the keyboard, the limits, and the
 * way out of what opens over the page.
 */

describe("Stepper", () => {
  function Harness({ initial = 3 }: { initial?: number }) {
    const [value, setValue] = useState(initial);
    return (
      <Stepper
        label="Vagas"
        value={value}
        min={1}
        max={4}
        decreaseLabel="Tirar uma vaga"
        increaseLabel="Pôr uma vaga"
        onChange={setValue}
      />
    );
  }

  it("counts up and down by tap and stops at the limits, saying so by disabling the button", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const more = screen.getByRole("button", { name: "Pôr uma vaga" });
    const less = screen.getByRole("button", { name: "Tirar uma vaga" });
    await user.click(more);
    expect(screen.getByRole("status", { name: "Vagas" }).textContent).toBe("4");
    expect(more).toHaveProperty("disabled", true);
    await user.click(less);
    await user.click(less);
    await user.click(less);
    expect(screen.getByRole("status", { name: "Vagas" }).textContent).toBe("1");
    expect(less).toHaveProperty("disabled", true);
  });

  it("works from the keyboard: Tab to the button, Enter or Space to press", async () => {
    const user = userEvent.setup();
    render(<Harness initial={2} />);
    await user.tab();
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Pôr uma vaga" }));
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(screen.getByRole("status", { name: "Vagas" }).textContent).toBe("4");
  });
});

describe("SwitchField", () => {
  function Harness() {
    const [on, setOn] = useState(false);
    return (
      <SwitchField checked={on} onChange={setOn}>
        Preço diferente por parada
      </SwitchField>
    );
  }

  it("is a switch named by its words, toggled from the words or the space bar", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const toggle = screen.getByRole("switch", { name: "Preço diferente por parada" });
    await user.click(screen.getByText("Preço diferente por parada"));
    expect(toggle.getAttribute("aria-checked")).toBe("true");
    toggle.focus();
    await user.keyboard(" ");
    expect(toggle.getAttribute("aria-checked")).toBe("false");
  });
});

describe("ToggleField", () => {
  function Harness() {
    const [value, setValue] = useState<readonly ("pix" | "cash")[]>(["pix"]);
    return (
      <ToggleField
        label="Pagamento"
        options={[
          { value: "pix", label: "PIX" },
          { value: "cash", label: "dinheiro" },
        ]}
        value={value}
        onChange={setValue}
      />
    );
  }

  it("lets several be on at once, each saying whether it is pressed", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const group = screen.getByRole("group", { name: "Pagamento" });
    const cash = within(group).getByRole("button", { name: "dinheiro" });
    await user.click(cash);
    expect(cash.getAttribute("aria-pressed")).toBe("true");
    expect(within(group).getByRole("button", { name: "PIX" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    await user.click(within(group).getByRole("button", { name: "PIX" }));
    expect(within(group).getByRole("button", { name: "PIX" }).getAttribute("aria-pressed")).toBe(
      "false",
    );
  });
});

describe("Chip", () => {
  it("says whether it is pressed and answers to Enter", async () => {
    const user = userEvent.setup();
    const onPress = vi.fn();
    render(
      <Chip pressed onPress={onPress} clears>
        Com vaga
      </Chip>,
    );
    const chip = screen.getByRole("button", { name: "Com vaga", pressed: true });
    chip.focus();
    await user.keyboard("{Enter}");
    expect(onPress).toHaveBeenCalledOnce();
  });
});

describe("Segmented", () => {
  function Harness() {
    const [value, setValue] = useState<"a" | "b" | "c">("a");
    return (
      <Segmented
        label="Tema"
        value={value}
        onChange={setValue}
        options={[
          { value: "a", label: "Sistema" },
          { value: "b", label: "Claro" },
          { value: "c", label: "Escuro" },
        ]}
      />
    );
  }

  it("chooses by tap and moves with the arrow keys, as a radio group does", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("radio", { name: "Claro" }));
    expect(screen.getByRole("radio", { name: "Claro" }).getAttribute("aria-checked")).toBe("true");
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: "Escuro" }).getAttribute("aria-checked")).toBe("true");
  });
});

describe("Sheet", () => {
  function Harness() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button
          type="button"
          onClick={() => {
            setOpen(true);
          }}
        >
          Abrir
        </button>
        <Sheet open={open} onOpenChange={setOpen} title="Novo carro" description="Três campos.">
          <label>
            Modelo
            <input />
          </label>
        </Sheet>
      </>
    );
  }

  it("opens as a dialog named by its title, and closes on Escape or on the close button", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Abrir" }));
    const sheet = screen.getByRole("dialog", { name: "Novo carro" });
    expect(within(sheet).getByText("Três campos.")).toBeDefined();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Abrir" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Fechar" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("takes typing right away in the field inside", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Abrir" }));
    await user.click(screen.getByLabelText("Modelo"));
    await user.keyboard("Gol");
    expect(screen.getByLabelText("Modelo")).toHaveProperty("value", "Gol");
  });
});

describe("ConfirmDialog", () => {
  function Harness({ onConfirm }: { onConfirm: () => void }) {
    const [open, setOpen] = useState(true);
    return (
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Cancelar esta carona?"
        description="Cancelar é definitivo."
        confirmLabel="Cancelar carona"
        onConfirm={onConfirm}
      />
    );
  }

  it("never confirms on Escape or on Voltar; only the red button confirms", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const { unmount } = render(<Harness onConfirm={onConfirm} />);
    expect(screen.getByRole("alertdialog", { name: "Cancelar esta carona?" })).toBeDefined();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("alertdialog")).toBeNull();
    unmount();

    render(<Harness onConfirm={onConfirm} />);
    await user.click(screen.getByRole("button", { name: "Voltar" }));
    expect(onConfirm).not.toHaveBeenCalled();
    unmount();

    render(<Harness onConfirm={onConfirm} />);
    await user.click(screen.getByRole("button", { name: "Cancelar carona" }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});
