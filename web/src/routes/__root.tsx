import { Link, Outlet, createRootRoute } from "@tanstack/react-router";

import { useSession } from "@/features/accounts/app/use-session";
import { useForgetBoardOffline } from "@/features/rides/app/use-forget-board-offline";
import { useNetworkStatus } from "@/shared/app/use-network-status";
import { useVersionFloor } from "@/shared/app/use-version-floor";
import { ActionButton } from "@/shared/ui/action-button";
import { AppFooter } from "@/shared/ui/app-footer";
import { AppNav, navLinkClass } from "@/shared/ui/app-nav";
import { AppShellNotices } from "@/shared/ui/app-shell-notices";
import { NoticeScreen } from "@/shared/ui/notice-screen";

export const Route = createRootRoute({ component: RootLayout });

function RootLayout() {
  const { session } = useSession();
  const network = useNetworkStatus();
  const floor = useVersionFloor();
  useForgetBoardOffline();
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
      {floor.status === "below-floor" ? (
        <NoticeScreen
          title="Atualize o BrazCar"
          action={
            <ActionButton emphasis="primary" onPress={floor.update}>
              Atualizar
            </ActionButton>
          }
        >
          Esta versão ({floor.version}) não funciona mais. Atualize para continuar.
        </NoticeScreen>
      ) : (
        <>
          {network === "offline" ? (
            // Online-only (D-051): nothing from the API is shown without a network, not even the old
            // board. The page stays mounted under this screen, so a form being typed is not lost.
            <NoticeScreen title="Sem internet">
              O BrazCar precisa de internet. Assim que a conexão voltar, esta tela some sozinha.
            </NoticeScreen>
          ) : (
            <AppShellNotices />
          )}
          <div hidden={network === "offline"} className="flex flex-1 flex-col">
            <Outlet />
          </div>
        </>
      )}
      <AppFooter version={floor.version} />
    </div>
  );
}
