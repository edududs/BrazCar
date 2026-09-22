import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";

import { changesBetween, draftOf } from "@/features/rides/app/ride-changes";
import { useRide } from "@/features/rides/app/use-ride";
import { formatTime } from "@/features/rides/ui/format";
import { RideForm } from "@/features/rides/ui/ride-form";
import { PageShell } from "@/shared/ui/page-shell";

export const Route = createFileRoute("/caronas/$rideId_/editar")({ component: EditRidePage });

function EditRidePage() {
  const { rideId } = Route.useParams();
  const { ride, status, edit, busy } = useRide(rideId);
  const navigate = useNavigate();
  const back = () => void navigate({ to: "/caronas/$rideId", params: { rideId } });
  return (
    <PageShell
      title="Editar carona"
      actions={
        <Link to="/caronas/$rideId" params={{ rideId }} className="underline">
          Voltar
        </Link>
      }
    >
      {status === "loading" ? (
        <p className="text-sm opacity-70">Carregando…</p>
      ) : ride === null ? (
        <p className="text-sm">Esta carona não existe.</p>
      ) : !ride.actions.canEdit ? (
        <p className="text-sm">Esta carona não pode mais ser editada.</p>
      ) : (
        <RideForm
          initial={draftOf(ride)}
          busy={busy}
          submitLabel="Salvar"
          departureHint={
            ride.actions.delayUntil === null
              ? "Antes de sair, o horário só muda dentro do mesmo dia."
              : `Depois de sair, só dá para adiar, até ${formatTime(ride.actions.delayUntil)}.`
          }
          onSubmit={(draft) => edit(changesBetween(ride, draft)).then(back)}
        />
      )}
    </PageShell>
  );
}
