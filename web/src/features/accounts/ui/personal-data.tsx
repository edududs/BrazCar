import type { ReactNode } from "react";

import { useCanSeePeople } from "../app/use-can-see-people";

interface PersonalDataProps {
  /** `line` for one fact, like a name; `block` for a paragraph, like notes or a WhatsApp post. */
  readonly fallback: "line" | "block";
  readonly children: ReactNode;
}

/**
 * The one place a screen decides whether it may draw someone's personal data (D-171): mounted
 * over `useCanSeePeople`, so the card, the detail and anywhere else this appears stop repeating
 * the same null check. Without a session, or while it is still being checked, this draws a
 * skeleton shaped like the content in place of `children`, never the content itself; once
 * someone is signed in, `children` renders as given, including nothing when the ride itself has
 * none of this fact.
 */
export function PersonalData({ fallback, children }: PersonalDataProps) {
  const visibility = useCanSeePeople();
  if (visibility !== "visible") {
    return <Skeleton shape={fallback} />;
  }
  return <>{children}</>;
}

const bar = "rounded-full bg-surface-2 motion-safe:animate-pulse";

/** A shape, never a word: `aria-hidden` so assistive tech skips straight past it. */
function Skeleton({ shape }: { readonly shape: "line" | "block" }) {
  if (shape === "line") {
    return <span aria-hidden className={`inline-block h-4 w-28 align-middle ${bar}`} />;
  }
  return (
    <span aria-hidden className="flex flex-col gap-2 py-0.5">
      <span className={`h-3.5 w-full ${bar}`} />
      <span className={`h-3.5 w-11/12 ${bar}`} />
      <span className={`h-3.5 w-2/3 ${bar}`} />
    </span>
  );
}
