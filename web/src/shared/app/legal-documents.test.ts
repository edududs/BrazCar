import { describe, expect, it } from "vitest";

import { legalTexts } from "../adapters/legal-texts";
import type { LegalDocumentKind } from "../domain/legal-documents";
import { legalDocument } from "./legal-documents";
import { parseMarkdown } from "./markdown";

const kinds: readonly LegalDocumentKind[] = ["terms", "privacy"];

describe.each(kinds)("the %s text of docs/", (kind) => {
  it("stays inside the Markdown subset the sheet can draw", () => {
    expect(() => parseMarkdown(legalTexts[kind])).not.toThrow();
  });

  it("has sections to read", () => {
    expect(legalDocument(kind).sections.length).toBeGreaterThan(0);
  });

  it("does not cite a decision: the trail runs from the decision to the text (D-180)", () => {
    expect(legalTexts[kind]).not.toMatch(/\bD-\d{3}\b/);
  });
});

describe("the titles", () => {
  it("name the documents for the person signing up", () => {
    expect(legalDocument("terms").title).toBe("Termos de uso");
    expect(legalDocument("privacy").title).toBe("Política de privacidade");
  });
});
