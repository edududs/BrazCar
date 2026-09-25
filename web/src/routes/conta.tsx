import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";

import { useChangePassword } from "@/features/accounts/app/use-change-password";
import { useSession } from "@/features/accounts/app/use-session";
import { AccountPanel } from "@/features/accounts/ui/account-panel";
import { useVersionFloor } from "@/shared/app/use-version-floor";
import { BrandMark } from "@/shared/ui/brand-mark";
import { Card } from "@/shared/ui/card";
import { PageShell } from "@/shared/ui/page-shell";
import { ThemeControl } from "@/shared/ui/theme-control";

export const Route = createFileRoute("/conta")({ component: AccountPage });

const primaryLink =
  "inline-flex min-h-target w-full items-center justify-center rounded-button bg-brand px-5 text-body font-semibold text-on-brand";
const quietLink =
  "inline-flex min-h-target w-full items-center justify-center rounded-button bg-surface-2 px-5 text-body font-semibold text-ink";

/** A list of groups, like the phone's settings (S10). Theme and the version work for anyone. */
function AccountPage() {
  const { session, busy, updateProfile, addCar, removeCar, logOut, deleteAccount } = useSession();
  const { changePassword, busy: passwordBusy } = useChangePassword();
  const navigate = useNavigate();
  const { version } = useVersionFloor();
  const appearance = <ThemeControl />;
  // The build's version, for support (D-105): it lives here since the footer went.
  const footer = <p className="text-center text-caption text-ink-3">BrazCar {version}</p>;
  return (
    <PageShell title="Minha conta">
      {session.status === "checking" ? (
        <p className="text-secondary text-ink-2">Verificando…</p>
      ) : session.status === "anonymous" ? (
        <>
          <Card>
            <div className="flex flex-col items-center gap-3.5 px-2 py-3 text-center">
              <BrandMark size={64} />
              <h2 className="font-display text-heading font-bold text-balance">
                Entre para publicar e pedir contato
              </h2>
              <p className="text-secondary text-ink-2">Ver o mural não precisa de conta.</p>
              <div className="flex w-full flex-col gap-2.5">
                <Link to="/entrar" className={primaryLink}>
                  Entrar
                </Link>
                <Link to="/cadastro" className={quietLink}>
                  Criar conta
                </Link>
              </div>
            </div>
          </Card>
          {appearance}
          {footer}
        </>
      ) : (
        <AccountPanel
          account={session.account}
          busy={busy}
          updateProfile={updateProfile}
          changePassword={changePassword}
          passwordBusy={passwordBusy}
          addCar={addCar}
          removeCar={removeCar}
          logOut={() =>
            logOut().then(
              () =>
                void navigate({
                  to: "/",
                  state: {
                    flash: {
                      message: "Você saiu da conta.",
                      action: { label: "Entrar", to: "/entrar" },
                    },
                  },
                }),
            )
          }
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
          appearance={appearance}
          footer={footer}
        />
      )}
    </PageShell>
  );
}
