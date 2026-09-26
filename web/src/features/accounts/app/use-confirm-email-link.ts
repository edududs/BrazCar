import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { useEmailConfirmation } from "./use-email-confirmation";
import { useSession } from "./use-session";

/**
 * Headless: opens the e-mail link's own page (D-168, D-167 mirrored for a change instead of a
 * signup). `needs-sign-in` carries where to come back to, since the token is meant for the
 * account it was mailed to; with a session, it confirms on its own, once, and leaves on success —
 * the route only draws whichever of these it is handed.
 */
export type ConfirmEmailLinkView =
  | { readonly status: "checking" }
  | { readonly status: "needs-sign-in"; readonly returnTo: string }
  | { readonly status: "confirming" }
  | { readonly status: "refused" };

export function useConfirmEmailLink(token: string): ConfirmEmailLinkView {
  const { session } = useSession();
  const { confirm } = useEmailConfirmation();
  const navigate = useNavigate();
  const [refused, setRefused] = useState(false);
  const attempted = useRef(false);

  useEffect(() => {
    if (session.status !== "signed-in" || attempted.current) return;
    attempted.current = true;
    confirm(token).then(
      () => void navigate({ to: "/conta", state: { flash: { message: "E-mail confirmado." } } }),
      () => {
        setRefused(true);
      },
    );
  }, [session.status, token, confirm, navigate]);

  if (session.status === "checking") return { status: "checking" };
  if (session.status === "anonymous") {
    return {
      status: "needs-sign-in",
      returnTo: `/confirmar-email?token=${encodeURIComponent(token)}`,
    };
  }
  return refused ? { status: "refused" } : { status: "confirming" };
}
