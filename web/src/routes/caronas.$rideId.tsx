import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";

import { useSession } from "@/features/accounts/app/use-session";
import { useRide } from "@/features/rides/app/use-ride";
import { localDay, relativeDay } from "@/shared/app/calendar";
import { RideDetail } from "@/features/rides/ui/ride-detail";
import { EmptyState } from "@/shared/ui/empty-state";

export const Route = createFileRoute("/caronas/$rideId")({ component: RidePage });

/** The ride's own page: no title, the time is the hero (S03); no tab bar, one goal (the root hides it). */
function RidePage() {
  const { rideId } = Route.useParams();
  const { session } = useSession();
  const actions = useRide(rideId);
  const navigate = useNavigate();
  return (
    <main className="flex flex-1 flex-col">
      <h1 className="sr-only">Carona</h1>
      {actions.status === "loading" ? (
        <p className="px-gutter py-5 text-secondary text-ink-2">Carregando…</p>
      ) : actions.status === "missing" ? (
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-gutter py-6">
          <EmptyState
            title="Esta carona não existe"
            action={
              <Link
                to="/"
                className="inline-flex min-h-target items-center justify-center rounded-button bg-brand px-5 text-body font-semibold text-on-brand"
              >
                Voltar ao mural
              </Link>
            }
          >
            O endereço pode estar incompleto, ou a carona importada já saiu do mural.
          </EmptyState>
        </div>
      ) : actions.ride === null ? (
        <p className="px-gutter py-5 text-secondary text-critical">
          Não foi possível carregar a carona.
        </p>
      ) : (
        <RideDetail
          ride={actions.ride}
          session={session}
          actions={actions}
          onRepeated={(ride) =>
            void navigate({
              to: "/caronas/$rideId",
              params: { rideId: ride.id },
              state: {
                flash: {
                  message: `Carona repetida. Esta é a nova, de ${relativeDay(localDay(new Date(ride.departureAt)), new Date())}.`,
                },
              },
            })
          }
        />
      )}
    </main>
  );
}
