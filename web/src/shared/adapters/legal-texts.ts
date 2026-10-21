import privacy from "../../../../docs/privacy.md?raw";
import terms from "../../../../docs/terms.md?raw";
import type { LegalDocumentKind } from "../domain/legal-documents";

/**
 * The legal texts as written in the repository's `docs/`, read at build time. The file there is
 * the single source (D-175): nothing is copied into `web/`.
 */
export const legalTexts: Readonly<Record<LegalDocumentKind, string>> = { terms, privacy };
