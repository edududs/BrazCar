import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";

import { useSession } from "@/features/accounts/app/use-session";
import { usePublishRide } from "@/features/rides/app/use-publish-ride";
import type { RideDraft } from "@/features/rides/domain/ride";
import { RideForm } from "@/features/rides/ui/ride-form";
import { useClock } from "@/shared/app/use-clock";
import { Icon } from "@/shared/ui/icon";
import { NoticeScreen } from "@/shared/ui/notice-screen";
import { PageShell } from "@/shared/ui/page-shell";

export const Route = createFileRoute("/publicar")({ component: PublishPage });

/** A blank ride: two stops, the next round half hour, three seats, the default price (D-014). */
function blankDraft(carId: string, now: Date): RideDraft {
  const departure = new Date(now);
  departure.setMinutes(departure.getMinutes() >= 30 ? 60 : 30, 0, 0);
  return {
    carId,
    stops: [
      { placeId: null, text: "", fare: "" },
      { placeId: null, text: "", fare: "" },
    ],
    departureAt: departure.toISOString(),
    seatsAvailable: 3,
    price: "7.00",
    paymentMethods: ["pix", "cash"],
    notes: "",
  };
}

const primaryLink =
  "inline-flex min-h-target w-full items-center justify-center rounded-button bg-brand px-5 text-body font-semibold text-on-brand";
const ghostLink =
  "inline-flex min-h-target w-full items-center justify-center rounded-button px-5 text-body font-semibold text-brand-ink";

/** The form opens over everything and closes on the X (S07); the tabs stay away. */
function PublishPage() {
  const { session } = useSession();
  const { publish, busy } = usePublishRide();
  const navigate = useNavigate();
  const now = useClock();
  return (
    <PageShell
      title="Publicar carona"
      heading="compact"
      back={{ to: "/", icon: "x", label: "Fechar" }}
    >
      {session.status === "checking" ? (
        <p className="text-secondary text-ink-2">Verificando…</p>
      ) : session.status === "anonymous" ? (
        <NoticeScreen
          title="Entre para publicar"
          glyph={<Icon name="user" size={32} />}
          glyphTone="brand"
          action={
            <Link to="/entrar" className={primaryLink}>
              Entrar
            </Link>
          }
        >
          Publicar uma carona pede uma conta, para o passageiro saber com quem combina.
        </NoticeScreen>
      ) : !session.account.canDrive ? (
        <NoticeScreen
          title="Cadastre um carro para publicar"
          glyph={<Icon name="car" size={32} />}
          glyphTone="brand"
          action={
            <div className="flex flex-col gap-2">
              <Link to="/conta" className={primaryLink}>
                Cadastrar um carro
              </Link>
              <Link to="/" className={ghostLink}>
                Voltar ao mural
              </Link>
            </div>
          }
        >
          O mural mostra só o modelo e a cor. A placa aparece apenas para quem pedir o contato.
        </NoticeScreen>
      ) : (
        <RideForm
          initial={blankDraft(session.account.cars[0]?.id ?? "", now)}
          cars={session.account.cars}
          busy={busy}
          now={now}
          submitLabel="Publicar carona"
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
