import { useSession } from "./use-session";

/**
 * `checking` while the session is still settling; a screen must draw a skeleton, never the
 * content, until this leaves `checking`. `hidden` for a visitor with no session (D-171); `visible`
 * once someone is signed in.
 */
export type PeopleVisibility = "checking" | "hidden" | "visible";

/**
 * Whether the visitor may see anyone's personal data — a driver's name, their car, notes they
 * wrote, the words a WhatsApp post carried — from the session alone (D-171). Every screen that
 * draws such a fact reads this once, instead of repeating its own null check; `PersonalData`
 * (`features/accounts/ui/personal-data.tsx`) is the component built on it.
 */
export function useCanSeePeople(): PeopleVisibility {
  const { session } = useSession();
  if (session.status === "checking") return "checking";
  return session.status === "signed-in" ? "visible" : "hidden";
}
