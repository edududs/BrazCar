import { Outlet, createRootRoute, useRouterState } from "@tanstack/react-router";

import { useSession } from "@/features/accounts/app/use-session";
import { useForgetBoardOffline } from "@/features/rides/app/use-forget-board-offline";
import { useNetworkStatus } from "@/shared/app/use-network-status";
import { useVersionFloor } from "@/shared/app/use-version-floor";
import { ActionButton } from "@/shared/ui/action-button";
import { BrandMark } from "@/shared/ui/brand-mark";
import { Icon } from "@/shared/ui/icon";
import { NoticeScreen } from "@/shared/ui/notice-screen";
import { RouteNotFound } from "@/shared/ui/route-not-found";
import { ShellOverlays } from "@/shared/ui/shell-overlays";
import { type Tab, TabBar } from "@/shared/ui/tab-bar";
import { Toast } from "@/shared/ui/toast";

export const Route = createRootRoute({ component: RootLayout, notFoundComponent: RouteNotFound });

function RootLayout() {
  const { session } = useSession();
  const network = useNetworkStatus();
  const floor = useVersionFloor();
  // Only the three places have tabs. A ride, a form or the way in has one goal and its own action
  // under the thumb: the tabs stay away there (S03, S07, S12).
  const stacked = useRouterState({
    select: (state) => !["/", "/minhas-caronas", "/conta"].includes(state.location.pathname),
  });
  useForgetBoardOffline();

  if (floor.status === "below-floor") {
    return (
      <div className="flex min-h-dvh flex-col justify-center bg-bg text-ink">
        <NoticeScreen
          title="Atualize o BrazCar"
          glyph={<BrandMark size={64} />}
          action={
            <ActionButton emphasis="primary" icon={<Icon name="refresh" />} onPress={floor.update}>
              Atualizar agora
            </ActionButton>
          }
        >
          Esta versão ({floor.version}) ficou para trás e não conversa mais com o mural. A
          atualização leva segundos e não apaga nada.
        </NoticeScreen>
      </div>
    );
  }

  const offline = network === "offline";
  const tabs: readonly Tab[] = [
    { to: "/", label: "Caronas", icon: "board" },
    { to: "/publicar", label: "Publicar", icon: "plus", primary: true },
    { to: "/minhas-caronas", label: "Minhas", icon: "route" },
    session.status === "signed-in"
      ? { to: "/conta", label: "Conta", icon: "user" }
      : { to: "/entrar", label: "Entrar", icon: "user" },
  ];
  return (
    <div className="flex min-h-dvh flex-col bg-bg text-ink">
      {/* Online-only (D-051): without a network the page stays mounted, so a form being typed is
          not lost, but it is dimmed and takes no input until the connection is back. */}
      <div
        inert={offline}
        className={`flex flex-1 flex-col pt-[env(safe-area-inset-top)] ${offline ? "shell-dimmed" : ""}`}
      >
        <Outlet />
      </div>
      {offline ? (
        <Toast
          role="alert"
          placement="top"
          icon={<Icon name="wifioff" size={16} />}
          iconTone="brand"
        >
          Sem internet. O mural volta sozinho quando a conexão voltar.
        </Toast>
      ) : (
        <ShellOverlays />
      )}
      {stacked ? null : <TabBar tabs={tabs} />}
    </div>
  );
}
