import { Link, createFileRoute } from "@tanstack/react-router";

import { useSession } from "@/features/accounts/app/use-session";
import { useMyRides } from "@/features/rides/app/use-my-rides";
import { RideList } from "@/features/rides/ui/ride-list";
import { EmptyState } from "@/shared/ui/empty-state";
import { PageShell } from "@/shared/ui/page-shell";

export const Route = createFileRoute("/minhas-caronas")({ component: MyRidesPage });

function MyRidesPage() {
  const { session } = useSession();
  return (
    <PageShell title="Minhas caronas">
      {session.status === "checking" ? (
        <p className="text-secondary text-ink-2">Verificando…</p>
      ) : session.status === "anonymous" ? (
        <EmptyState
          title="Entre para ver suas caronas"
          action={
            <Link
              to="/entrar"
              className="inline-flex min-h-target items-center justify-center rounded-button bg-brand px-5 text-body font-semibold text-on-brand"
            >
              Entrar
            </Link>
          }
        >
          As caronas que você publicar aparecem aqui e no mural.
        </EmptyState>
      ) : (
        <MyRidesList />
      )}
    </PageShell>
  );
}

function MyRidesList() {
  const mine = useMyRides();
  return (
    <RideList
      rides={mine.rides}
      status={mine.status}
      grouping="mine"
      emptyText="Você ainda não publicou caronas."
      emptyDetail="Quando publicar, ela aparece aqui e no mural. Daqui dá para mudar as vagas, editar, repetir e cancelar."
      emptyAction={
        <Link
          to="/publicar"
          className="inline-flex min-h-target items-center justify-center gap-2 rounded-button bg-brand px-5 text-body font-semibold text-on-brand"
        >
          Publicar carona
        </Link>
      }
    />
  );
}
