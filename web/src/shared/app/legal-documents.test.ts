import { describe, expect, it } from "vitest";

import { legalTexts } from "../adapters/legal-texts";
import type { LegalDocumentKind } from "../domain/legal-documents";
import type { MarkdownBlock, MarkdownInline } from "../domain/markdown";
import { legalDocument } from "./legal-documents";
import { parseMarkdown } from "./markdown";

const kinds: readonly LegalDocumentKind[] = ["terms", "privacy"];

function inlinesOf(block: MarkdownBlock): readonly MarkdownInline[] {
  return block.kind === "paragraph" ? block.content : block.items.flat();
}

function allInlines(kind: LegalDocumentKind): readonly MarkdownInline[] {
  const document = legalDocument(kind);
  const blocks = [...document.lead, ...document.sections.flatMap((section) => section.blocks)];
  return blocks.flatMap(inlinesOf);
}

describe.each(kinds)("the %s text of docs/", (kind) => {
  it("stays inside the Markdown subset the sheet can draw", () => {
    expect(() => parseMarkdown(legalTexts[kind])).not.toThrow();
  });

  it("has sections to read", () => {
    expect(legalDocument(kind).sections.length).toBeGreaterThan(0);
  });

  it("links only to absolute https addresses, never into the app", () => {
    const links = allInlines(kind).filter((run) => run.kind === "link");

    for (const link of links) expect(link.href).toMatch(/^https:\/\//);
  });

  it("does not cite a decision: the trail runs from the decision to the text (D-175)", () => {
    expect(legalTexts[kind]).not.toMatch(/\bD-\d{3}\b/);
  });
});

describe("the titles", () => {
  it("name the documents for the person signing up", () => {
    expect(legalDocument("terms").title).toBe("Termos de uso");
    expect(legalDocument("privacy").title).toBe("Política de privacidade");
  });
});
