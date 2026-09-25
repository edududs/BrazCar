import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";

import { useChangePassword } from "@/features/accounts/app/use-change-password";
import { useSession } from "@/features/accounts/app/use-session";
import { useVersionFloor } from "@/shared/app/use-version-floor";
import { AccountPanel } from "@/features/accounts/ui/account-panel";
import { inlineLinkClass } from "@/shared/ui/link-class";
import { PageShell } from "@/shared/ui/page-shell";
import { ThemeControl } from "@/shared/ui/theme-control";

export const Route = createFileRoute("/conta")({ component: AccountPage });

function AccountPage() {
  const { session, busy, updateProfile, addCar, removeCar, logOut, deleteAccount } = useSession();
  const { changePassword, busy: passwordBusy } = useChangePassword();
  const navigate = useNavigate();
  const { version } = useVersionFloor();
  return (
    <PageShell title="Minha conta">
      {session.status === "checking" ? (
        <p className="text-secondary text-ink-2">Verificando…</p>
      ) : session.status === "anonymous" ? (
        <p className="text-sm">
          Você não está conectado.{" "}
          <Link to="/entrar" className={inlineLinkClass}>
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
      {/* Theme and opinion work for anyone, signed in or not (S10). */}
      <ThemeControl />
      {/* The build's version, for support (D-105): it lives here since the footer went. */}
      <p className="text-center text-caption text-ink-3">BrazCar {version}</p>
    </PageShell>
  );
}
