import { mkdirSync, rmSync } from "node:fs";

import { notesDir, screensDir, sessionsFile } from "./fixtures";
import { mailDir } from "./origins";

/**
 * A full regeneration starts from nothing, so a state that no longer exists leaves no picture
 * behind (D-134). Only `yarn screens` sets the flag; without it the suite never writes into
 * `docs/screens/` at all, so running the tests leaves the catalogue exactly as it was.
 */
export default function globalSetup(): void {
  // Sessions belong to one run: the seed recreates the accounts, so older cookies are worthless.
  rmSync(sessionsFile, { force: true });
  // The mailbox belongs to one run too: an e-mail from a previous run must never look like the
  // latest one to an address this run reuses (D-166 to D-168). The backend also creates this
  // directory on its own the first time it writes to it, but the suite starts it empty either way.
  rmSync(mailDir, { recursive: true, force: true });
  mkdirSync(mailDir, { recursive: true });
  if (process.env.BRAZCAR_SCREENS !== "1") return;
  rmSync(screensDir, { recursive: true, force: true });
  rmSync(notesDir, { recursive: true, force: true });
}
