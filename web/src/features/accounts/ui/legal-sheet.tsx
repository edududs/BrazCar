import { legalDocument } from "@/shared/app/legal-documents";
import type { LegalDocumentKind } from "@/shared/domain/legal-documents";
import { ActionButton } from "@/shared/ui/action-button";
import { MarkdownView } from "@/shared/ui/markdown-view";
import { Sheet } from "@/shared/ui/sheet";

interface LegalSheetProps {
  readonly kind: LegalDocumentKind;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** "Li e aceito": the caller marks its checkbox and closes the sheet. */
  readonly onAccept: () => void;
}

/** One of the legal texts, readable in place, with the acceptance always within reach. */
export function LegalSheet({ kind, open, onOpenChange, onAccept }: LegalSheetProps) {
  const document = legalDocument(kind);
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={document.title}
      footer={
        <ActionButton emphasis="primary" onPress={onAccept}>
          Li e aceito
        </ActionButton>
      }
    >
      <MarkdownView document={document} />
    </Sheet>
  );
}
