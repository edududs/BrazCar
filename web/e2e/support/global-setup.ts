import { rmSync } from "node:fs";

import { notesDir, screensDir, sessionsFile } from "./fixtures";

/**
 * A full regeneration starts from nothing, so a state that no longer exists leaves no picture
 * behind (D-134). Only `yarn screens` sets the flag; without it the suite never writes into
 * `docs/screens/` at all, so running the tests leaves the catalogue exactly as it was.
 */
export default function globalSetup(): void {
  // Sessions belong to one run: the seed recreates the accounts, so older cookies are worthless.
  rmSync(sessionsFile, { force: true });
  if (process.env.BRAZCAR_SCREENS !== "1") return;
  rmSync(screensDir, { recursive: true, force: true });
  rmSync(notesDir, { recursive: true, force: true });
}
