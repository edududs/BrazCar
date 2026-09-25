// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Badge } from "./badge";
import { Icon } from "./icon";

describe("Badge", () => {
  it("renders its text in every tone, with an optional icon that stays unnamed", () => {
    render(
      <>
        <Badge tone="inverse">Lotada</Badge>
        <Badge tone="outline" icon={<Icon name="chat" size={16} />}>
          via WhatsApp
        </Badge>
        <Badge tone="sun">Agora</Badge>
      </>,
    );
    expect(screen.getByText("Lotada")).toBeTruthy();
    expect(screen.getByText("via WhatsApp")).toBeTruthy();
    expect(screen.getByText("Agora")).toBeTruthy();
    expect(screen.queryByRole("img")).toBeNull();
  });
});
