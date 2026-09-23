import { Link, Outlet, createRootRoute } from "@tanstack/react-router";

import { useSession } from "@/features/accounts/app/use-session";
import { AppNav, navLinkClass } from "@/shared/ui/app-nav";

export const Route = createRootRoute({ component: RootLayout });

function RootLayout() {
  const { session } = useSession();
  return (
    <div className="flex min-h-dvh flex-col bg-surface text-content">
      <AppNav
        brand={
          <Link to="/" className={navLinkClass}>
            BrazCar
          </Link>
        }
      >
        <Link to="/publicar" className={navLinkClass}>
          Publicar
        </Link>
        <Link to="/minhas-caronas" className={navLinkClass}>
          Minhas
        </Link>
        {session.status === "signed-in" ? (
          <Link to="/conta" className={navLinkClass}>
            Conta
          </Link>
        ) : (
          <Link to="/entrar" className={navLinkClass}>
            Entrar
          </Link>
        )}
      </AppNav>
      <Outlet />
    </div>
  );
}
