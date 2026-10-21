import type { MarkdownBlock, MarkdownDocument, MarkdownInline } from "../domain/markdown";

/** A construct outside the supported subset, with the 1-based line where it was found. */
export class MarkdownSyntaxError extends Error {
  readonly line: number;

  constructor(message: string, line: number) {
    super(`line ${String(line)}: ${message}`);
    this.name = "MarkdownSyntaxError";
    this.line = line;
  }
}

type Line =
  | { readonly kind: "title" | "section" | "item" | "continuation" | "text"; readonly text: string }
  | { readonly kind: "blank" };

// --- Lines -----------------------------------------------------------------------------------

function refuseBlockSyntax(line: string, no: number): void {
  const text = line.trimStart();
  if (text.startsWith("```") || text.startsWith("~~~")) {
    throw new MarkdownSyntaxError("found a code fence, which is not supported", no);
  }
  if (/^[-*_=\s]+$/.test(text)) {
    throw new MarkdownSyntaxError("found a rule or a setext heading, which is not supported", no);
  }
  if (text.startsWith("* ") || text.startsWith("+ ")) {
    throw new MarkdownSyntaxError("found a list marker other than '- '", no);
  }
  if (/^\d+[.)](?:\s|$)/.test(text)) {
    throw new MarkdownSyntaxError("found a numbered list, which is not supported", no);
  }
  if (text.startsWith(">")) throw new MarkdownSyntaxError("found a block quote", no);
  if (text.startsWith("|")) throw new MarkdownSyntaxError("found a table", no);
  if (line.startsWith(" ") && text.startsWith("- ")) {
    throw new MarkdownSyntaxError("found a nested list, which is not supported", no);
  }
}

function refuseHeadingSyntax(line: string, no: number): void {
  const hashes = /^#+/.exec(line)?.[0].length ?? 0;
  if (hashes >= 3) throw new MarkdownSyntaxError("found a heading deeper than '##'", no);
  if (hashes > 0 && !line.startsWith(`${"#".repeat(hashes)} `)) {
    throw new MarkdownSyntaxError("found a '#' without a space after it", no);
  }
}

function classifyLine(line: string, no: number): Line {
  if (line === "") return { kind: "blank" };
  refuseHeadingSyntax(line, no);
  refuseBlockSyntax(line, no);
  if (line.startsWith("## ")) return { kind: "section", text: line.slice(3).trim() };
  if (line.startsWith("# ")) return { kind: "title", text: line.slice(2).trim() };
  if (line.startsWith("- ")) return { kind: "item", text: line.slice(2).trim() };
  if (line.startsWith(" ")) return { kind: "continuation", text: line.trim() };
  return { kind: "text", text: line };
}

// --- Inline ----------------------------------------------------------------------------------

const REFUSED_CHARACTERS: Readonly<Record<string, string>> = {
  "`": "inline code",
  "*": "a '*' outside a '**bold**' pair",
  _: "an underscore",
  "<": "a '<'",
  "[": "a '[' outside a link",
  "]": "a ']' outside a link",
  "\\": "a backslash",
  "~": "a '~'",
  "|": "a '|'",
};

const HTML_ENTITY = /^&(?:#\d+|#x[\da-f]+|[a-z][a-z\d]*);/i;
const BARE_URL = /^https?:\/\//i;

/** Refuses what the character at `at` would mean in Markdown but this subset does not draw. */
function refuseAt(text: string, at: number, no: number): void {
  const char = text.charAt(at);
  const refused = REFUSED_CHARACTERS[char];
  if (refused !== undefined) throw new MarkdownSyntaxError(`found ${refused}`, no);
  const rest = text.slice(at);
  if (char === "!" && rest.startsWith("![")) throw new MarkdownSyntaxError("found an image", no);
  if (char === "&" && HTML_ENTITY.test(rest)) {
    throw new MarkdownSyntaxError("found an HTML entity", no);
  }
  if (BARE_URL.test(rest)) throw new MarkdownSyntaxError("found a bare URL outside a link", no);
}

/** Text that holds no formatting at all, as bold, link labels and headings must. */
function plainText(text: string, no: number, where: string): string {
  if (text === "") throw new MarkdownSyntaxError(`found an empty ${where}`, no);
  for (let at = 0; at < text.length; at += 1) refuseAt(text, at, no);
  return text;
}

function readStrong(text: string, at: number, no: number): [MarkdownInline, number] {
  const close = text.indexOf("**", at + 2);
  if (close < 0) throw new MarkdownSyntaxError("found a '**' that is never closed", no);
  const content = plainText(text.slice(at + 2, close), no, "bold run");
  return [{ kind: "strong", text: content }, close + 2];
}

function readLink(text: string, at: number, no: number): [MarkdownInline, number] {
  const labelEnd = text.indexOf("](", at);
  const hrefEnd = labelEnd < 0 ? -1 : text.indexOf(")", labelEnd + 2);
  if (hrefEnd < 0) throw new MarkdownSyntaxError("found a '[' outside a link", no);
  const label = plainText(text.slice(at + 1, labelEnd), no, "link label");
  const href = text.slice(labelEnd + 2, hrefEnd);
  if (href === "" || /\s/.test(href)) {
    throw new MarkdownSyntaxError("found a link address that is empty or has a space", no);
  }
  return [{ kind: "link", text: label, href }, hrefEnd + 1];
}

/** Reads bold, links and text, merging neighbouring text. `no` is the line reported on refusal. */
function parseInline(text: string, no: number): readonly MarkdownInline[] {
  const runs: MarkdownInline[] = [];
  let pending = "";
  const flushText = () => {
    if (pending !== "") runs.push({ kind: "text", text: pending });
    pending = "";
  };
  let at = 0;
  while (at < text.length) {
    const isBold = text.startsWith("**", at);
    if (isBold || text.charAt(at) === "[") {
      flushText();
      const [run, next] = isBold ? readStrong(text, at, no) : readLink(text, at, no);
      runs.push(run);
      at = next;
    } else {
      refuseAt(text, at, no);
      pending += text.charAt(at);
      at += 1;
    }
  }
  flushText();
  return runs;
}

function headingText(text: string, no: number, where: string): string {
  if (text === "") throw new MarkdownSyntaxError(`found an empty ${where}`, no);
  for (const run of parseInline(text, no)) {
    if (run.kind !== "text") {
      throw new MarkdownSyntaxError(`found bold or a link in the ${where}`, no);
    }
  }
  return text;
}

// --- Blocks ----------------------------------------------------------------------------------

/** A paragraph or a list still being read: the text of each paragraph line or list item. */
interface OpenBlock {
  readonly kind: "paragraph" | "list";
  readonly texts: string[];
  /** The line each entry of `texts` started on, so an inline refusal points at it. */
  readonly lines: number[];
}

function closeBlock(open: OpenBlock): MarkdownBlock {
  if (open.kind === "paragraph") {
    return {
      kind: "paragraph",
      content: parseInline(open.texts.join(" "), open.lines[0] ?? 1),
    };
  }
  return {
    kind: "list",
    items: open.texts.map((text, index) => parseInline(text, open.lines[index] ?? 1)),
  };
}

/** Collects lines into blocks and blocks into sections, in document order. */
class DocumentBuilder {
  private title: string | null = null;
  private readonly lead: MarkdownBlock[] = [];
  private readonly sections: { heading: string; blocks: MarkdownBlock[] }[] = [];
  private open: OpenBlock | null = null;

  accept(line: Line, no: number): void {
    if (line.kind === "blank") {
      this.flush();
      return;
    }
    if (this.title === null && line.kind !== "title") {
      throw new MarkdownSyntaxError("the document must start with a '# ' title", no);
    }
    switch (line.kind) {
      case "title":
        this.setTitle(line.text, no);
        break;
      case "section":
        this.openSection(line.text, no);
        break;
      case "item":
        this.addItem(line.text, no);
        break;
      case "continuation":
        this.continueItem(line.text, no);
        break;
      case "text":
        this.addText(line.text, no);
        break;
    }
  }

  build(): MarkdownDocument {
    this.flush();
    if (this.title === null) throw new MarkdownSyntaxError("the document is empty", 1);
    return { title: this.title, lead: this.lead, sections: this.sections };
  }

  private setTitle(text: string, no: number): void {
    if (this.title !== null) throw new MarkdownSyntaxError("found a second '# ' title", no);
    this.title = headingText(text, no, "title");
  }

  private openSection(text: string, no: number): void {
    this.flush();
    this.sections.push({ heading: headingText(text, no, "section heading"), blocks: [] });
  }

  private addItem(text: string, no: number): void {
    const list = this.open?.kind === "list" ? this.open : this.start("list");
    list.texts.push(text);
    list.lines.push(no);
  }

  private continueItem(text: string, no: number): void {
    if (this.open?.kind !== "list") {
      throw new MarkdownSyntaxError("found an indented line outside a list item", no);
    }
    const last = this.open.texts.length - 1;
    this.open.texts[last] = `${this.open.texts[last] ?? ""} ${text}`;
  }

  private addText(text: string, no: number): void {
    if (this.open?.kind === "list") {
      throw new MarkdownSyntaxError(
        "found text right after a list item; indent it to continue the item, or leave a blank line",
        no,
      );
    }
    const paragraph = this.open ?? this.start("paragraph");
    paragraph.texts.push(text);
    paragraph.lines.push(no);
  }

  private start(kind: OpenBlock["kind"]): OpenBlock {
    this.flush();
    const open: OpenBlock = { kind, texts: [], lines: [] };
    this.open = open;
    return open;
  }

  private flush(): void {
    const open = this.open;
    this.open = null;
    if (open === null) return;
    (this.sections.at(-1)?.blocks ?? this.lead).push(closeBlock(open));
  }
}

/**
 * Reads the small Markdown subset the legal texts use: a `#` title, `##` sections, paragraphs,
 * `-` lists, `**bold**` and `[links](https://...)`. Anything else is refused with its line, so a
 * future edit that leaves the subset fails a test instead of showing raw symbols on a phone.
 */
export function parseMarkdown(source: string): MarkdownDocument {
  const builder = new DocumentBuilder();
  source
    .replaceAll("\r\n", "\n")
    .split("\n")
    .forEach((raw, index) => {
      const no = index + 1;
      builder.accept(classifyLine(raw.trimEnd(), no), no);
    });
  return builder.build();
}
