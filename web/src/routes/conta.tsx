import { Link, createFileRoute } from "@tanstack/react-router";

import { useSession } from "@/features/accounts/app/use-session";
import { AccountPanel } from "@/features/accounts/ui/account-panel";
import { PageShell } from "@/shared/ui/page-shell";

export const Route = createFileRoute("/conta")({ component: AccountPage });

function AccountPage() {
  const { session, busy, addCar, removeCar, logOut } = useSession();
  return (
    <PageShell title="Minha conta">
      {session.status === "checking" ? (
        <p className="text-sm opacity-70">Verificando…</p>
      ) : session.status === "anonymous" ? (
        <p className="text-sm">
          Você não está conectado.{" "}
          <Link to="/entrar" className="underline">
            Entrar
          </Link>
        </p>
      ) : (
        <AccountPanel
          account={session.account}
          busy={busy}
          addCar={addCar}
          removeCar={removeCar}
          logOut={logOut}
        />
      )}
    </PageShell>
  );
}
