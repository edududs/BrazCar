import { Link } from "@tanstack/react-router";

import { EmptyState } from "./empty-state";

/** What the app shows for any address that matches no route (D-007): in Portuguese, with a way back. */
export function RouteNotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-gutter py-6">
      <EmptyState
        as="h1"
        title="Página não encontrada"
        action={
          <Link
            to="/"
            className="inline-flex min-h-target items-center justify-center rounded-button bg-brand px-5 text-body font-semibold text-on-brand"
          >
            Voltar ao mural
          </Link>
        }
      >
        Este endereço não existe no BrazCar.
      </EmptyState>
    </main>
  );
}
