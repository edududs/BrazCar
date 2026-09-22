import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";

import { useSession } from "@/features/accounts/app/use-session";
import { usePublishRide } from "@/features/rides/app/use-publish-ride";
import type { RideDraft } from "@/features/rides/domain/ride";
import { RideForm } from "@/features/rides/ui/ride-form";
import { PageShell } from "@/shared/ui/page-shell";

export const Route = createFileRoute("/publicar")({ component: PublishPage });

/** A blank ride: two stops, the next round hour, three seats, the default price (D-014). */
function blankDraft(carId: string): RideDraft {
  const departure = new Date();
  departure.setHours(departure.getHours() + 1, 0, 0, 0);
  return {
    carId,
    stops: [
      { placeId: null, text: "" },
      { placeId: null, text: "" },
    ],
    departureAt: departure.toISOString(),
    seatsAvailable: 3,
    price: "7.00",
    paymentMethods: ["pix", "cash"],
  };
}

function PublishPage() {
  const { session } = useSession();
  const { publish, busy } = usePublishRide();
  const navigate = useNavigate();
  return (
    <PageShell
      title="Publicar carona"
      actions={
        <Link to="/" className="underline">
          Mural
        </Link>
      }
    >
      {session.status === "checking" ? (
        <p className="text-sm opacity-70">Verificando…</p>
      ) : session.status === "anonymous" ? (
        <p className="text-sm">
          <Link to="/entrar" className="underline">
            Entre
          </Link>{" "}
          para publicar uma carona.
        </p>
      ) : !session.account.canDrive ? (
        <p className="text-sm">
          Para publicar, cadastre um carro em{" "}
          <Link to="/conta" className="underline">
            sua conta
          </Link>
          .
        </p>
      ) : (
        <RideForm
          initial={blankDraft(session.account.cars[0]?.id ?? "")}
          cars={session.account.cars}
          busy={busy}
          submitLabel="Publicar"
          onSubmit={(draft) =>
            publish(draft).then(
              (ride) => void navigate({ to: "/caronas/$rideId", params: { rideId: ride.id } }),
            )
          }
        />
      )}
    </PageShell>
  );
}
