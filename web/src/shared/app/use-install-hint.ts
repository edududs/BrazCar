import { useState } from "react";

import { detectDisplayMode, installsByHand } from "../adapters/display-mode";
import { readFlag, writeFlag } from "../adapters/local-flags";

const DISMISSED = "install-hint-dismissed";

export interface InstallHint {
  readonly visible: boolean;
  readonly dismiss: () => void;
}

/**
 * Tells iPhone users, in a tab, how to add the app to the home screen. Once dismissed it stays away
 * on this device: a hint that keeps coming back is a nuisance, and there is no button that installs.
 */
export function useInstallHint(): InstallHint {
  const [visible, setVisible] = useState(
    () => installsByHand() && detectDisplayMode() === "browser" && !readFlag(DISMISSED),
  );
  return {
    visible,
    dismiss: () => {
      writeFlag(DISMISSED);
      setVisible(false);
    },
  };
}
