// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { CheckboxField } from "./checkbox-field";

function Harness() {
  const [checked, setChecked] = useState(false);
  return (
    <CheckboxField checked={checked} onChange={setChecked}>
      Li e aceito os <a href="https://example.com/termos">termos</a>
    </CheckboxField>
  );
}

describe("CheckboxField", () => {
  it("toggles from its text and from the space bar", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const box = screen.getByRole("checkbox", { name: "Li e aceito os termos" });
    await user.click(screen.getByText("Li e aceito os", { exact: false }));
    expect(box).toHaveProperty("checked", true);
    await user.keyboard(" ");
    expect(box).toHaveProperty("checked", false);
  });

  it("a link nested in the text keeps its own click, and never checks the box", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const box = screen.getByRole("checkbox", { name: "Li e aceito os termos" });

    await user.click(screen.getByRole("link", { name: "termos" }));

    expect(box).toHaveProperty("checked", false);
  });
});
