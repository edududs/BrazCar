/**
 * Where the two servers of the suite answer.
 *
 * Both on `localhost`, on different ports: the session cookie is `SameSite=Lax` (ADR-0012) and a
 * port is not part of a site, so front and API stay same-site here just as they are siblings of
 * `elj-labs.org` in production. Putting one of them on `127.0.0.1` would make them cross-site and
 * no request would carry the session.
 */

export const apiPort = Number(process.env.BRAZCAR_E2E_API_PORT ?? 8100);
export const webPort = Number(process.env.BRAZCAR_E2E_WEB_PORT ?? 4173);
export const apiOrigin = `http://localhost:${String(apiPort)}`;
export const webOrigin = `http://localhost:${String(webPort)}`;

/** Where the seed writes what it made, relative to `web/`. */
export const manifestPath = "e2e/.state/manifest.json";
