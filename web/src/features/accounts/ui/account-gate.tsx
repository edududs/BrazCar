import { useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { useEmailConfirmation } from "../app/use-email-confirmation";
import { useSession } from "../app/use-session";
import { HeldAccountScreen } from "./held-account-screen";

interface AccountGateProps {
  readonly children: ReactNode;
}

/** Where the board's own filters reset to, once signing out or deleting sends the account back
 * there (D-168): the same defaults `/`'s own route falls back to. */
const boardHome = { q: null, day: null, withSeats: false, maxPrice: null, from: null } as const;

/**
 * Stands guard wherever writing matters (D-168): a held, signed-in account sees "Falta confirmar
 * seu e-mail" instead of `children`, so `/conta`, `/publicar`, `/minhas-caronas` and editing a
 * ride do not each repeat the check. Checking and anonymous stay each route's own screen — only a
 * signed-in, held account is intercepted here.
 */
export function AccountGate({ children }: AccountGateProps) {
  const { session, logOut, deleteAccount, busy } = useSession();
  const { view } = useEmailConfirmation();
  const navigate = useNavigate();

  if (session.status !== "signed-in" || session.account.requiredAction === null) {
    return <>{children}</>;
  }

  return (
    <HeldAccountScreen
      account={session.account}
      view={view}
      busy={busy}
      logOut={() =>
        logOut().then(
          () =>
            void navigate({
              to: "/",
              search: { ...boardHome, accountDeleted: false },
              state: {
                flash: {
                  message: "Você saiu da conta.",
                  action: { label: "Entrar", to: "/entrar" },
                },
              },
            }),
        )
      }
      deleteAccount={() =>
        deleteAccount().then(
          () => void navigate({ to: "/", search: { ...boardHome, accountDeleted: true } }),
        )
      }
    />
  );
}
