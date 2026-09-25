import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";

import { useChangePassword } from "@/features/accounts/app/use-change-password";
import { useSession } from "@/features/accounts/app/use-session";
import { AccountPanel } from "@/features/accounts/ui/account-panel";
import { PageShell } from "@/shared/ui/page-shell";

export const Route = createFileRoute("/conta")({ component: AccountPage });

function AccountPage() {
  const { session, busy, updateProfile, addCar, removeCar, logOut, deleteAccount } = useSession();
  const { changePassword, busy: passwordBusy } = useChangePassword();
  const navigate = useNavigate();
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
          updateProfile={updateProfile}
          changePassword={changePassword}
          passwordBusy={passwordBusy}
          addCar={addCar}
          removeCar={removeCar}
          logOut={logOut}
          deleteAccount={deleteAccount}
          onDeleted={() => {
            void navigate({
              to: "/",
              search: {
                q: null,
                day: null,
                withSeats: false,
                maxPrice: null,
                from: null,
                accountDeleted: true,
              },
            });
          }}
        />
      )}
    </PageShell>
  );
}
