// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ExternalLink } from "./external-link";

describe("ExternalLink", () => {
  it("opens the address in a new tab, without handing the new page a reference back", () => {
    render(<ExternalLink href="https://example.com/terms">termos de uso</ExternalLink>);

    const link = screen.getByRole("link", { name: "termos de uso" });
    expect(link.getAttribute("href")).toBe("https://example.com/terms");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noreferrer");
  });
});
