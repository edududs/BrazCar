// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Icon } from "./icon";
import { IconButton } from "./icon-button";
import { ListRow } from "./list-row";

describe("ListRow", () => {
  it("shows the title and the subtitle without being pressable itself", () => {
    render(<ListRow icon={<Icon name="car" />} title="Gol prata" subtitle="ABC1D23" />);

    expect(screen.getByText("Gol prata")).toBeTruthy();
    expect(screen.getByText("ABC1D23")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("leaves the end to whatever is given, like a button that works on its own", async () => {
    const user = userEvent.setup();
    const onPress = vi.fn();
    render(
      <ListRow
        icon={<Icon name="car" />}
        title="Gol prata"
        trailing={<IconButton icon="trash" label="Remover Gol prata" onPress={onPress} />}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Remover Gol prata" }));

    expect(onPress).toHaveBeenCalledOnce();
  });

  it("sets the subtitle in monospace when asked", () => {
    render(<ListRow icon={<Icon name="car" />} title="Gol" subtitle="ABC1D23" monoSubtitle />);

    expect(screen.getByText("ABC1D23").className).toContain("font-mono");
  });
});
