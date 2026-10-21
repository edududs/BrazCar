/** One run inside a paragraph or a list item: plain text, bold text, or a link. */
export type MarkdownInline =
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "strong"; readonly text: string }
  | { readonly kind: "link"; readonly text: string; readonly href: string };

export type MarkdownBlock =
  | { readonly kind: "paragraph"; readonly content: readonly MarkdownInline[] }
  | { readonly kind: "list"; readonly items: readonly (readonly MarkdownInline[])[] };

export interface MarkdownSection {
  readonly heading: string;
  readonly blocks: readonly MarkdownBlock[];
}

/** A document in the fixed Markdown subset the legal texts are written in. */
export interface MarkdownDocument {
  readonly title: string;
  /** What comes before the first `##`. */
  readonly lead: readonly MarkdownBlock[];
  readonly sections: readonly MarkdownSection[];
}
