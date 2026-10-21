import type { ReactNode } from "react";

import { inlineLinkClass } from "./link-class";

interface InlineButtonProps {
  readonly onPress: () => void;
  readonly children: ReactNode;
}

/**
 * An action inside a sentence that opens something in place, where `ExternalLink` leaves the app.
 * It is a button, so a field that wraps the sentence leaves it alone instead of taking its click.
 */
export function InlineButton({ onPress, children }: InlineButtonProps) {
  return (
    <button type="button" onClick={onPress} className={inlineLinkClass}>
      {children}
    </button>
  );
}
