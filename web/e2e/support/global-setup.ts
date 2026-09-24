import { rmSync } from "node:fs";

import { notesDir, screensDir } from "./fixtures";

/**
 * A full regeneration starts from nothing, so a state that no longer exists leaves no picture
 * behind (D-134). Only `yarn screens` sets the flag: `yarn e2e` keeps whatever is on disk, so a
 * single suite run does not empty the catalogue.
 */
export default function globalSetup(): void {
  if (process.env.BRAZCAR_SCREENS !== "1") return;
  rmSync(screensDir, { recursive: true, force: true });
  rmSync(notesDir, { recursive: true, force: true });
}
