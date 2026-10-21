import type { MarkdownBlock, MarkdownDocument, MarkdownInline } from "@/shared/domain/markdown";

import { ExternalLink } from "./external-link";

interface MarkdownViewProps {
  readonly document: MarkdownDocument;
}

/**
 * Draws a parsed document: the lead and the sections. The title is left to whoever shows it (a
 * sheet already has its own), and section headings are level 3 under that sheet's level 2.
 */
export function MarkdownView({ document }: MarkdownViewProps) {
  return (
    <div className="flex flex-col gap-5 text-secondary text-ink">
      <Blocks blocks={document.lead} />
      {document.sections.map((section, index) => (
        <section key={index} className="flex flex-col gap-2.5">
          <h3 className="font-display text-body font-bold text-balance">{section.heading}</h3>
          <Blocks blocks={section.blocks} />
        </section>
      ))}
    </div>
  );
}

function Blocks({ blocks }: { readonly blocks: readonly MarkdownBlock[] }) {
  return blocks.map((block, index) =>
    block.kind === "paragraph" ? (
      <p key={index}>
        <Inlines runs={block.content} />
      </p>
    ) : (
      <ul key={index} className="flex list-disc flex-col gap-1.5 pl-5">
        {block.items.map((item, itemIndex) => (
          <li key={itemIndex}>
            <Inlines runs={item} />
          </li>
        ))}
      </ul>
    ),
  );
}

function Inlines({ runs }: { readonly runs: readonly MarkdownInline[] }) {
  return runs.map((run, index) => {
    if (run.kind === "strong") return <strong key={index}>{run.text}</strong>;
    if (run.kind === "link") {
      return (
        <ExternalLink key={index} href={run.href}>
          {run.text}
        </ExternalLink>
      );
    }
    return run.text;
  });
}
