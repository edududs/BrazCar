// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { parseMarkdown } from "@/shared/app/markdown";

import { MarkdownView } from "./markdown-view";

const source = [
  "# Título do documento",
  "",
  "Abertura com **destaque**.",
  "",
  "## Primeira seção",
  "",
  "- um item",
  "- outro item com [um link](https://exemplo.com/pagina)",
  "",
  "## Segunda seção",
  "",
  "Fecho.",
].join("\n");

describe("MarkdownView", () => {
  it("draws section headings at level 3, and the document title not at all", () => {
    render(<MarkdownView document={parseMarkdown(source)} />);

    expect(screen.getAllByRole("heading").map((heading) => heading.textContent)).toEqual([
      "Primeira seção",
      "Segunda seção",
    ]);
    expect(screen.getByRole("heading", { name: "Primeira seção", level: 3 })).toBeDefined();
    expect(screen.queryByText("Título do documento")).toBeNull();
  });

  it("draws list items, paragraphs and bold", () => {
    render(<MarkdownView document={parseMarkdown(source)} />);

    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("destaque").tagName).toBe("STRONG");
    expect(screen.getByText("Fecho.")).toBeDefined();
  });

  it("opens a link in a new tab", () => {
    render(<MarkdownView document={parseMarkdown(source)} />);

    const link = screen.getByRole("link", { name: "um link" });
    expect(link.getAttribute("href")).toBe("https://exemplo.com/pagina");
    expect(link.getAttribute("target")).toBe("_blank");
  });
});
