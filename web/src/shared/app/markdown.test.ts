import { describe, expect, it } from "vitest";

import { MarkdownSyntaxError, parseMarkdown } from "./markdown";

const text = (value: string) => ({ kind: "text", text: value }) as const;

describe("parseMarkdown, the supported subset", () => {
  it("reads a title alone", () => {
    expect(parseMarkdown("# Termos de uso\n")).toEqual({
      title: "Termos de uso",
      lead: [],
      sections: [],
    });
  });

  it("keeps what comes before the first section as the lead", () => {
    const doc = parseMarkdown("# T\n\nAbertura.\n\n## Seção\n\nCorpo.\n");

    expect(doc.lead).toEqual([{ kind: "paragraph", content: [text("Abertura.")] }]);
    expect(doc.sections).toEqual([
      { heading: "Seção", blocks: [{ kind: "paragraph", content: [text("Corpo.")] }] },
    ]);
  });

  it("opens a section at every second-level heading, even without a blank line", () => {
    const doc = parseMarkdown("# T\n## A\num\n## B\ndois\n");

    expect(doc.sections.map((section) => section.heading)).toEqual(["A", "B"]);
    expect(doc.sections.map((section) => section.blocks.length)).toEqual([1, 1]);
  });

  it("joins the lines of a paragraph with a space and trims their ends", () => {
    const doc = parseMarkdown("# T\n\numa linha  \noutra linha\n");

    expect(doc.lead).toEqual([{ kind: "paragraph", content: [text("uma linha outra linha")] }]);
  });

  it("reads list items, with an indented line continuing the item", () => {
    const doc = parseMarkdown(
      "# T\n\n- primeiro\n- segundo\n  continua\n  e termina\n- terceiro\n",
    );

    expect(doc.lead).toEqual([
      {
        kind: "list",
        items: [[text("primeiro")], [text("segundo continua e termina")], [text("terceiro")]],
      },
    ]);
  });

  it("starts a list right after a paragraph and a paragraph after a blank line", () => {
    const doc = parseMarkdown("# T\n\nIntro:\n- a\n\nFim.\n");

    expect(doc.lead.map((block) => block.kind)).toEqual(["paragraph", "list", "paragraph"]);
  });

  it("reads bold and links, merging the text around them", () => {
    const doc = parseMarkdown(
      "# T\n\nUm **forte** e [o site](https://exemplo.com/a_b) fim, mais [outro](https://x.org).\n",
    );

    expect(doc.lead).toEqual([
      {
        kind: "paragraph",
        content: [
          text("Um "),
          { kind: "strong", text: "forte" },
          text(" e "),
          { kind: "link", text: "o site", href: "https://exemplo.com/a_b" },
          text(" fim, mais "),
          { kind: "link", text: "outro", href: "https://x.org" },
          text("."),
        ],
      },
    ]);
  });

  it("reads inline marks that a line break splits, once the lines are joined", () => {
    const doc = parseMarkdown("# T\n\nveja [o\ntexto](https://x.org)\n");

    expect(doc.lead).toEqual([
      {
        kind: "paragraph",
        content: [text("veja "), { kind: "link", text: "o texto", href: "https://x.org" }],
      },
    ]);
  });

  it("reads CRLF like LF", () => {
    expect(parseMarkdown("# T\r\n\r\n## S\r\n\r\n- a\r\n")).toEqual(
      parseMarkdown("# T\n\n## S\n\n- a\n"),
    );
  });

  it("allows accents, punctuation and quotes in the text", () => {
    const doc = parseMarkdown('# T\n\nOlá, "mundo": 100% (ok) - sim; e & mais!\n');

    expect(doc.lead).toEqual([
      { kind: "paragraph", content: [text('Olá, "mundo": 100% (ok) - sim; e & mais!')] },
    ]);
  });
});

describe("parseMarkdown, what it refuses", () => {
  const refused: readonly (readonly [string, string, number])[] = [
    ["an empty document", "", 1],
    ["a document without a title", "texto\n", 1],
    ["a first line that is a section", "## S\n", 1],
    ["a second title", "# A\n\n# B\n", 3],
    ["a third-level heading", "# T\n\n### S\n", 3],
    ["a deeper heading", "# T\n\n###### S\n", 3],
    ["a hash without a space", "# T\n\n#S\n", 3],
    ["a bare hash", "# T\n\n#\n", 3],
    ["an asterisk list", "# T\n\n* a\n", 3],
    ["a plus list", "# T\n\n+ a\n", 3],
    ["a numbered list with a dot", "# T\n\n1. a\n", 3],
    ["a numbered list with a paren", "# T\n\n1) a\n", 3],
    ["a block quote", "# T\n\n> a\n", 3],
    ["a backtick fence", "# T\n\n```\n", 3],
    ["a tilde fence", "# T\n\n~~~\n", 3],
    ["a dash rule", "# T\n\n---\n", 3],
    ["an asterisk rule", "# T\n\n***\n", 3],
    ["an underscore rule", "# T\n\n___\n", 3],
    ["a setext underline", "# T\n\nTexto\n===\n", 4],
    ["a table row", "# T\n\n| a | b |\n", 3],
    ["an indented line after a paragraph", "# T\n\ntexto\n  mais\n", 4],
    ["an indented line at the start", "# T\n\n  texto\n", 3],
    ["a nested list", "# T\n\n- a\n  - b\n", 4],
    ["text glued to a list item", "# T\n\n- a\nb\n", 4],
    ["bold in the title", "# **T**\n", 1],
    ["a link in a section heading", "# T\n\n## [a](https://x.org)\n", 3],
    ["an empty section heading", "# T\n\n## \n", 3],
  ];

  it.each(refused)("%s", (_name, source, line) => {
    const error = catchError(() => parseMarkdown(source));

    expect(error).toBeInstanceOf(MarkdownSyntaxError);
    expect(error.line).toBe(line);
  });

  const refusedInline: readonly (readonly [string, string])[] = [
    ["inline code", "use `isso`"],
    ["a lone asterisk", "uma * solta"],
    ["an unclosed bold", "uma **negrito solta"],
    ["an empty bold", "uma **** vazia"],
    ["italics with underscores", "uma _ênfase_"],
    ["an HTML tag", "uma <b>tag</b>"],
    ["a bracket outside a link", "um [colchete"],
    ["a closing bracket outside a link", "um colchete]"],
    ["a link without an address", "veja [aqui]"],
    ["a link with an empty address", "veja [aqui]()"],
    ["a link with a space in the address", "veja [aqui](https://x.org/a b)"],
    ["a link with an empty label", "veja [](https://x.org)"],
    ["a javascript link", "veja [a](javascript:alert(1))"],
    ["a data link", "veja [a](data:text/html,x)"],
    ["an http link", "veja [a](http://x.org)"],
    ["a relative link", "veja [a](decisions/README.md)"],
    ["bold in a link label", "veja [**a**](https://x.org)"],
    ["a link inside bold", "veja **[a](https://x.org)**"],
    ["an image", "veja ![a](https://x.org/a.png)"],
    ["a backslash", "uma \\ barra"],
    ["a tilde", "uma ~riscada~"],
    ["a pipe", "uma a|b"],
    ["a named entity", "uma &amp; entidade"],
    ["a numeric entity", "uma &#123; entidade"],
    ["a hex entity", "uma &#x1F; entidade"],
    ["a bare http URL", "veja http://x.org"],
    ["a bare https URL", "veja https://x.org"],
  ];

  it.each(refusedInline)("%s, in a paragraph, pointing at its first line", (_name, inline) => {
    const error = catchError(() => parseMarkdown(`# T\n\nlinha um\n${inline}\n`));

    expect(error).toBeInstanceOf(MarkdownSyntaxError);
    expect(error.line).toBe(3);
  });

  it.each(refusedInline)("%s, in a list item, pointing at that item", (_name, inline) => {
    const error = catchError(() => parseMarkdown(`# T\n\n- certo\n- ${inline}\n`));

    expect(error).toBeInstanceOf(MarkdownSyntaxError);
    expect(error.line).toBe(4);
  });

  it("names the line in the message", () => {
    const error = catchError(() => parseMarkdown("# T\n\n`x`\n"));

    expect(error.message).toMatch(/^line 3: /);
  });
});

function catchError(run: () => unknown): MarkdownSyntaxError {
  try {
    run();
  } catch (error) {
    if (error instanceof MarkdownSyntaxError) return error;
    throw error;
  }
  throw new Error("expected the text to be refused");
}
