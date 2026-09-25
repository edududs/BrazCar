import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { changesBetween, draftOf } from "@/features/rides/app/ride-changes";
import { useRide } from "@/features/rides/app/use-ride";
import { formatTime } from "@/features/rides/ui/format";
import { RideForm } from "@/features/rides/ui/ride-form";
import { useClock } from "@/shared/app/use-clock";
import { NoticeBar } from "@/shared/ui/notice-bar";
import { PageShell } from "@/shared/ui/page-shell";

export const Route = createFileRoute("/caronas/$rideId_/editar")({ component: EditRidePage });

/** The same form as publishing, stacked over the ride: the rule of the day comes before the error (S08). */
function EditRidePage() {
  const { rideId } = Route.useParams();
  const { ride, status, edit, busy } = useRide(rideId);
  const navigate = useNavigate();
  const now = useClock();
  const saved = (updated: { departureAt: string }) =>
    void navigate({
      to: "/caronas/$rideId",
      params: { rideId },
      state: {
        flash: {
          message: `Alterações salvas. O mural já mostra ${formatTime(updated.departureAt)}.`,
        },
      },
    });
  return (
    <PageShell
      title="Editar carona"
      heading="compact"
      back={{ to: "/caronas/$rideId", params: { rideId }, icon: "back", label: "Voltar" }}
    >
      {status === "loading" ? (
        <p className="text-secondary text-ink-2">Carregando…</p>
      ) : ride === null ? (
        <p className="text-secondary">Esta carona não existe.</p>
      ) : !ride.actions.canEdit ? (
        <p className="text-secondary">Esta carona não pode mais ser editada.</p>
      ) : (
        <>
          <NoticeBar tone="info">
            {ride.actions.delayUntil === null
              ? "Antes de sair, o horário só muda dentro do mesmo dia."
              : `Depois de sair, só dá para adiar, até ${formatTime(ride.actions.delayUntil)}.`}
          </NoticeBar>
          <RideForm
            initial={draftOf(ride)}
            busy={busy}
            now={now}
            dayLocked
            submitLabel="Salvar alterações"
            onSubmit={(draft) => edit(changesBetween(ride, draft)).then(saved)}
          />
        </>
      )}
    </PageShell>
  );
}
