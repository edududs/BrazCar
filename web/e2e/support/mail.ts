import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { mailDir, webOrigin } from "./origins";

/**
 * Reads the invite and e-mail-confirmation links straight off the file the suite's backend writes
 * to instead of `mail.outbox` (D-166 to D-168): `EMAIL_BACKEND` in `playwright.config.ts` is
 * Django's filebased backend, one file per e-mail sent, in `mailDir`.
 */

const DEFAULT_TIMEOUT_MS = 5_000;
const POLL_MS = 100;

/**
 * Undoes quoted-printable, the encoding Django's own `utf-8` charset picks for a body with
 * accented characters (`Olá`, `não`…): soft line breaks (`=` at the end of a line) disappear, and
 * `=XX` becomes the byte `0xXX`. Bytes are collected before decoding as UTF-8, so a multi-byte
 * accented character split across `=XX` escapes comes back correctly.
 */
function decodeQuotedPrintable(text: string): string {
  const normalized = text.replace(/\r\n/g, "\n");
  const bytes: number[] = [];
  // `charAt` (unlike indexing) stays typed as `string` under `noUncheckedIndexedAccess`, and
  // returns "" past the end, which never matches "=" or the hex check below.
  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized.charAt(index);
    if (char === "=") {
      if (normalized.charAt(index + 1) === "\n") {
        index += 1; // soft line break: the line was folded, not the text
        continue;
      }
      const hex = normalized.slice(index + 1, index + 3);
      if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
        bytes.push(Number.parseInt(hex, 16));
        index += 2;
        continue;
      }
    }
    bytes.push(char.codePointAt(0) ?? 0);
  }
  return Buffer.from(bytes).toString("utf8");
}

interface ParsedMail {
  readonly to: string;
  readonly body: string;
  readonly sentAtMs: number;
}

/** One `.log` file is one e-mail (D-133, D-134): the filebased backend opens, writes and closes a
 * fresh file for every call to `send_mail`. `null` for anything that is not a full message yet, so
 * a file caught mid-write is skipped instead of breaking the read. */
function parseMail(file: string): ParsedMail | null {
  const raw = readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  const boundary = raw.indexOf("\n\n");
  if (boundary === -1) return null;
  // RFC 822 folding: a continuation line starts with whitespace and belongs to the header above.
  const headerBlock = raw.slice(0, boundary).replace(/\n[ \t]+/g, " ");
  const to = /^To:\s*(.+)$/im.exec(headerBlock)?.[1]?.trim();
  if (to === undefined) return null;
  const encoding = /^Content-Transfer-Encoding:\s*(.+)$/im
    .exec(headerBlock)?.[1]
    ?.trim()
    .toLowerCase();
  const rawBody = raw.slice(boundary + 2);
  const body = encoding === "quoted-printable" ? decodeQuotedPrintable(rawBody) : rawBody;
  return { to, body, sentAtMs: statSync(file).mtimeMs };
}

function linkIn(body: string, pathPrefix: string): string | null {
  const escaped = `${webOrigin}${pathPrefix}`.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`${escaped}[^\\s"'<>]+`).exec(body)?.[0] ?? null;
}

/**
 * The link inside the newest e-mail addressed to `address` whose body carries a link starting
 * with `${webOrigin}${pathPrefix}` — never the newest file in the directory, because `mobile`,
 * `mobile-dark` and `desktop` mail themselves in parallel and would otherwise read each other's
 * link. Waits, since the request that triggers the e-mail is asynchronous from the front's point
 * of view: the file may not exist yet the instant this is called.
 */
export async function latestLinkTo(
  address: string,
  pathPrefix: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    let newest: { readonly link: string; readonly sentAtMs: number } | null = null;
    let files: readonly string[];
    try {
      files = readdirSync(mailDir);
    } catch {
      files = [];
    }
    for (const name of files) {
      let parsed: ParsedMail | null;
      try {
        parsed = parseMail(path.join(mailDir, name));
      } catch {
        continue; // caught the file mid-write; the next poll sees it whole
      }
      if (parsed?.to !== address) continue;
      const link = linkIn(parsed.body, pathPrefix);
      if (link === null) continue;
      if (parsed.sentAtMs > (newest?.sentAtMs ?? -Infinity)) {
        newest = { link, sentAtMs: parsed.sentAtMs };
      }
    }
    if (newest !== null) return newest.link;
    if (Date.now() >= deadline) {
      throw new Error(
        `no e-mail to ${address} with a link under ${pathPrefix} showed up in ${String(timeoutMs)}ms`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
}
