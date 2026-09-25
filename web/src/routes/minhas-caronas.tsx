import { Link, createFileRoute } from "@tanstack/react-router";

import { useSession } from "@/features/accounts/app/use-session";
import { useMyRides } from "@/features/rides/app/use-my-rides";
import { RideList } from "@/features/rides/ui/ride-list";
import { PageShell } from "@/shared/ui/page-shell";
import { inlineLinkClass } from "@/shared/ui/link-class";

export const Route = createFileRoute("/minhas-caronas")({ component: MyRidesPage });

function MyRidesPage() {
  const { session } = useSession();
  return (
    <PageShell title="Minhas caronas">
      {session.status === "checking" ? (
        <p className="text-secondary text-ink-2">Verificando…</p>
      ) : session.status === "anonymous" ? (
        <p className="text-sm">
          <Link to="/entrar" className={inlineLinkClass}>
            Entre
          </Link>{" "}
          para ver suas caronas.
        </p>
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
