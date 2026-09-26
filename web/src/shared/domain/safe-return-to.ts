/**
 * Whether a search param is safe to send someone back to after signing in: only a path inside
 * this app, with nothing a browser could still read as pointing somewhere else. Guards against an
 * open redirect through `/entrar?returnTo=...`.
 *
 * - It must start with a single `/`: anything with its own scheme (`https://…`, `javascript:…`)
 *   never does.
 * - No control character or space (`\u0000`–` `, which includes tab, CR and LF): a browser
 *   strips those from a URL before it navigates, so `/<TAB>/evil.example.com` becomes
 *   `//evil.example.com` on the way there, even though the string handed to `isSafeReturnTo`
 *   still looks like an internal path. A literal `%09` is not this: nothing here decodes it, and
 *   the router does not either when it navigates by `href`, so `/%09/evil.com` stays one path
 *   segment and is accepted.
 * - No `/` immediately followed by `/` or `\` once every `\` is read as a `/`: a browser reads
 *   either as a scheme-relative address, whatever mix of the two produced it.
 */
export function isSafeReturnTo(value: string): boolean {
  if (!value.startsWith("/")) return false;
  // eslint-disable-next-line no-control-regex -- exactly the range a browser strips from a URL.
  if (/[\u0000- ]/.test(value)) return false;
  return !value.replace(/\\/g, "/").startsWith("//");
}
