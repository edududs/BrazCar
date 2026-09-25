import { Link } from "@tanstack/react-router";

import { NoticeScreen } from "./notice-screen";

/** What the app shows for any address that matches no route (D-007): in Portuguese, with a way back. */
export function RouteNotFound() {
  return (
    <NoticeScreen
      title="Página não encontrada"
      action={
        <Link
          to="/"
          className="flex min-h-target items-center justify-center rounded-button bg-surface-2 px-5 text-body font-semibold text-ink"
        >
          Voltar ao mural
        </Link>
      }
    >
      Este endereço não existe no BrazCar.
    </NoticeScreen>
  );
}
