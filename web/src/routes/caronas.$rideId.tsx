import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { useSession } from "@/features/accounts/app/use-session";
import { useRide } from "@/features/rides/app/use-ride";
import { RideDetail } from "@/features/rides/ui/ride-detail";
import { PageShell } from "@/shared/ui/page-shell";

export const Route = createFileRoute("/caronas/$rideId")({ component: RidePage });

function RidePage() {
  const { rideId } = Route.useParams();
  const { session } = useSession();
  const actions = useRide(rideId);
  const navigate = useNavigate();
  return (
    <PageShell title="Carona">
      {actions.status === "loading" ? (
        <p className="text-sm opacity-70">Carregando…</p>
      ) : actions.status === "missing" ? (
        <p className="text-sm">Esta carona não existe.</p>
      ) : actions.ride === null ? (
        <p className="text-sm text-critical">Não foi possível carregar a carona.</p>
      ) : (
        <RideDetail
          ride={actions.ride}
          session={session}
          actions={actions}
          onRepeated={(ride) =>
            void navigate({ to: "/caronas/$rideId", params: { rideId: ride.id } })
          }
        />
      )}
    </PageShell>
  );
}
