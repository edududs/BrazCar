import { Link, createFileRoute } from "@tanstack/react-router";

import { useSession } from "@/features/accounts/app/use-session";
import { useMyRides } from "@/features/rides/app/use-my-rides";
import { RideList } from "@/features/rides/ui/ride-list";
import { PageShell } from "@/shared/ui/page-shell";

export const Route = createFileRoute("/minhas-caronas")({ component: MyRidesPage });

function MyRidesPage() {
  const { session } = useSession();
  return (
    <PageShell
      title="Minhas caronas"
      actions={
        <>
          <Link to="/publicar" className="underline">
            Publicar
          </Link>
          <Link to="/" className="underline">
            Mural
          </Link>
        </>
      }
    >
      {session.status === "checking" ? (
        <p className="text-sm opacity-70">Verificando…</p>
      ) : session.status === "anonymous" ? (
        <p className="text-sm">
          <Link to="/entrar" className="underline">
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
      emptyText="Você ainda não publicou caronas."
    />
  );
}
