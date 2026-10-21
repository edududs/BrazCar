import { legalTexts } from "../adapters/legal-texts";
import type { LegalDocumentKind } from "../domain/legal-documents";
import type { MarkdownDocument } from "../domain/markdown";
import { parseMarkdown } from "./markdown";

// Read once, when the module loads: a text outside the Markdown subset fails here, not on a tap.
const documents: Readonly<Record<LegalDocumentKind, MarkdownDocument>> = {
  terms: parseMarkdown(legalTexts.terms),
  privacy: parseMarkdown(legalTexts.privacy),
};

export function legalDocument(kind: LegalDocumentKind): MarkdownDocument {
  return documents[kind];
}
