/**
 * Whether a search param is safe to send someone back to after signing in: only a path inside
 * this app. `//evil.example.com` and `/\evil.example.com` are still schemeless, but a browser
 * reads either as pointing somewhere else, and anything with its own scheme never starts with a
 * single `/` at all. Guards against an open redirect through `/entrar?returnTo=...`.
 */
export function isSafeReturnTo(value: string): boolean {
  return value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\");
}
