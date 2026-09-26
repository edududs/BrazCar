import { Link } from "@tanstack/react-router";
import { useState } from "react";

import type { Session } from "@/features/accounts/domain/session";
import { addDays } from "@/shared/app/calendar";
import { ActionBar } from "@/shared/ui/action-bar";
import { ActionButton } from "@/shared/ui/action-button";
import { Avatar } from "@/shared/ui/avatar";
import { Badge } from "@/shared/ui/badge";
import { Card } from "@/shared/ui/card";
import { ConfirmDialog } from "@/shared/ui/confirm-dialog";
import { Icon } from "@/shared/ui/icon";
import { ListGroup, ListRowButton, ListRowLink } from "@/shared/ui/list-row";
import { NoticeBar } from "@/shared/ui/notice-bar";
import { Sheet } from "@/shared/ui/sheet";
import { Stepper } from "@/shared/ui/stepper";
import { TextField } from "@/shared/ui/text-field";

import { skyOf } from "../app/sky";
import { useContact } from "../app/use-contact";
import type { RideActions } from "../app/use-ride";
import { type Contact, MAX_SEATS, type OriginMessage, type Ride } from "../domain/ride";
import {
  firstNameOf,
  formatDay,
  formatDayLong,
  formatPayment,
  formatPrice,
  formatTime,
  fromLocalInput,
  toLocalInput,
} from "./format";
import { Plate } from "./plate";
import { reasonOf } from "./reason";
import { RouteList } from "./route-line";
import { SeatPips } from "./seat-pips";
import { StatusBadge } from "./status-badge";

interface RideDetailProps {
  readonly ride: Ride;
  readonly session: Session;
  readonly actions: RideActions;
  readonly onRepeated: (ride: Ride) => void;
}

const skyClass = {
  dawn: "[--sky:var(--sky-dawn)]",
  day: "[--sky:var(--sky-day)]",
  dusk: "[--sky:var(--sky-dusk)]",
  night: "[--sky:var(--sky-night)]",
} as const;

/**
 * One ride in full (S03 to S06): the time as the hero under the sky of its hour, the route as a
 * line, the facts, then who drives, with the contact revealed right there. Which buttons exist is
 * the API's call (ADR-0011); this only draws them.
 */
export function RideDetail({ ride, session, actions, onRepeated }: RideDetailProps) {
  const contacting = useContact(ride.id);
  const gone = ride.status === "cancelled" || ride.status === "departed";
  const acceptsContact = ride.status === "open" || ride.status === "reopened";

  return (
    <div className="relative flex flex-1 flex-col">
      <div
        aria-hidden
        className={`ride-sky pointer-events-none absolute inset-x-0 top-0 h-[380px] bg-[radial-gradient(130%_90%_at_85%_-5%,var(--sky)_0%,transparent_68%)] ${skyClass[skyOf(ride.departureAt)]}`}
      />
      <div
        aria-hidden
        className="ride-compact pointer-events-none fixed inset-x-0 top-0 z-10 flex items-center justify-center gap-2 border-b border-line bg-glass pt-[env(safe-area-inset-top)] pb-2.5 backdrop-blur-[22px]"
      >
        <span className="mt-2.5 flex items-center gap-2 text-body">
          <span className="font-display font-bold tabular-nums">
            {formatTime(ride.departureAt)}
          </span>
          <span className="font-medium text-ink-2">
            {ride.stops[0]?.label} → {ride.stops[ride.stops.length - 1]?.label}
          </span>
        </span>
      </div>
      <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-gutter pt-2 pb-5">
        <div className="flex min-h-11 items-center">
          <Link
            to="/"
            aria-label="Voltar ao mural"
            className="grid size-11 place-items-center rounded-full bg-glass text-ink shadow-1 ring-1 ring-line backdrop-blur-[16px]"
          >
            <Icon name="back" />
          </Link>
        </div>

        <header className="flex flex-col gap-2 pt-1.5 pb-1">
          <p className="flex flex-wrap items-center gap-2 text-secondary font-semibold text-ink-2">
            {formatDayLong(ride.departureAt)}
            {ride.isMine ? <Badge tone="accent">Sua carona</Badge> : null}
            <StatusBadge status={ride.status} />
            {ride.origin === "whatsapp" && ride.isMine ? (
              <Badge tone="outline" icon={<Icon name="chat" size={16} />}>
                WhatsApp
              </Badge>
            ) : null}
          </p>
          <p
            style={{ viewTransitionName: `ride-time-${ride.id}` }}
            className={`ride-time font-display text-time-xl font-bold tabular-nums ${
              ride.status === "cancelled"
                ? "line-through decoration-[5px] text-ink-3"
                : ride.status === "departed"
                  ? "text-ink-3"
                  : ""
            }`}
          >
            {formatTime(ride.departureAt)}
          </p>
        </header>

        <Card padding="tight">
          <RouteList stops={ride.stops} />
        </Card>
        {ride.hasFares ? (
          <p className="-mt-1.5 px-1 text-caption text-ink-3">
            Preço de cada parada, contado de onde a carona sai.
          </p>
        ) : null}

        {ride.isMine ? (
          <OwnerPanel ride={ride} actions={actions} onRepeated={onRepeated} />
        ) : (
          <Facts ride={ride} />
        )}
        {ride.notes === null ? null : (
          <Card>
            <h2 className="text-label font-bold tracking-[0.08em] text-ink-3 uppercase">
              {ride.isMine ? "Suas observações" : `Observações de ${firstNameOf(ride.driverName)}`}
            </h2>
            <p className="text-base leading-[1.55] whitespace-pre-line text-ink text-pretty">
              {ride.notes}
            </p>
          </Card>
        )}
        {ride.isMine ? null : (
          <>
            <DriverCard
              ride={ride}
              contact={contacting.contact}
              locked={!gone && ride.status !== "full"}
              signedIn={session.status === "signed-in"}
            />
          </>
        )}

        {ride.originMessage === null ? null : (
          <OriginMessageCard message={ride.originMessage} mine={ride.isMine} />
        )}
      </div>

      {ride.isMine ? null : (
        <PassengerActions
          ride={ride}
          session={session}
          contacting={contacting}
          acceptsContact={acceptsContact}
        />
      )}
    </div>
  );
}

/** Seats, price and payment, side by side (S03). */
function Facts({ ride }: { readonly ride: Ride }) {
  const fact =
    "flex min-w-0 flex-col gap-1.5 rounded-[18px] border border-line-soft bg-surface px-3 pt-3 pb-3.5 shadow-1";
  const label = "text-label font-bold tracking-[0.08em] text-ink-3 uppercase";
  const value = "flex items-center gap-1.5 text-lg leading-[1.15] font-bold tabular-nums";
  return (
    <dl className="grid grid-cols-3 gap-2">
      <div className={fact}>
        <dt className={label}>Vagas</dt>
        <dd className={value}>
          {ride.status === "cancelled" ? (
            "—"
          ) : (
            <SeatPips available={ride.seatsAvailable} wordy={false} />
          )}
        </dd>
      </div>
      <div className={fact}>
        <dt className={label}>Preço</dt>
        <dd className={value}>{formatPrice(ride.price)}</dd>
        {ride.hasFares ? <dd className="text-caption text-ink-2">a partir de</dd> : null}
      </div>
      <div className={fact}>
        <dt className={label}>Paga com</dt>
        <dd className={`${value} text-secondary`}>{formatPayment(ride.paymentMethods)}</dd>
      </div>
    </dl>
  );
}

interface DriverCardProps {
  readonly ride: Ride;
  readonly contact: Contact | null;
  /** Whether the ride still takes contact requests: says what will appear here, and why not yet. */
  readonly locked: boolean;
  readonly signedIn: boolean;
}

/** Who drives, and, once asked for, how to reach them: the phone and the plate land right here (ADR-0006). */
function DriverCard({ ride, contact, locked, signedIn }: DriverCardProps) {
  return (
    <Card highlight={contact !== null}>
      <div className="flex items-center gap-3">
        <Avatar name={ride.driverName} size={48} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-body font-bold">{ride.driverName}</span>
          <span className="text-sm text-ink-2">
            {ride.car === null
              ? "Anunciou num grupo de WhatsApp"
              : `${ride.car.model} ${ride.car.color}`}
          </span>
        </div>
        {ride.origin === "whatsapp" ? (
          <Badge tone="outline" icon={<Icon name="chat" size={16} />}>
            via WhatsApp
          </Badge>
        ) : null}
      </div>
      {contact === null ? (
        locked ? (
          <p className="flex items-center gap-2 border-t border-line-soft pt-3 text-caption text-ink-3">
            <Icon name="lock" size={16} />
            {signedIn
              ? "Telefone e placa aparecem aqui quando você pedir o contato."
              : "Telefone e placa só aparecem para quem entra e pede o contato."}
          </p>
        ) : null
      ) : (
        <>
          <div className="border-t border-line-soft" />
          <dl className="flex animate-reveal flex-col">
            <div className="flex min-h-11 items-center justify-between gap-3">
              <dt className="flex items-center gap-2 text-sm text-ink-2">
                <Icon name="phone" size={16} />
                WhatsApp
              </dt>
              <dd className="text-[21px] font-bold tracking-[-0.01em] tabular-nums">
                {contact.phoneDisplay}
              </dd>
            </div>
            {contact.plate === null ? null : (
              <div className="flex min-h-11 items-center justify-between gap-3">
                <dt className="flex items-center gap-2 text-sm text-ink-2">
                  <Icon name="car" size={16} />
                  Placa
                </dt>
                <dd>
                  <Plate plate={contact.plate} />
                </dd>
              </div>
            )}
          </dl>
          <p className="text-caption text-ink-3">
            {contact.plate === null
              ? "Sem placa cadastrada: confirme o carro com o motorista antes de entrar."
              : "Confira a placa antes de entrar: é ela que garante o carro certo."}
          </p>
        </>
      )}
    </Card>
  );
}

interface PassengerActionsProps {
  readonly ride: Ride;
  readonly session: Session;
  readonly contacting: ReturnType<typeof useContact>;
  readonly acceptsContact: boolean;
}

/** The one action under the thumb, and what the ride's state says instead of it (S03, S04). */
function PassengerActions({ ride, session, contacting, acceptsContact }: PassengerActionsProps) {
  const [error, setError] = useState<string | null>(null);
  const back = (
    <Link
      to="/"
      className="inline-flex min-h-target items-center justify-center rounded-button text-body font-semibold text-ink inset-ring-[1.5px] inset-ring-line-strong"
    >
      Ver outras caronas
    </Link>
  );

  if (ride.status === "full") {
    return (
      <ActionBar>
        <NoticeBar tone="neutral">
          Esta carona lotou. Se o motorista liberar uma vaga, ela volta a aceitar contato.
        </NoticeBar>
        {back}
      </ActionBar>
    );
  }
  if (ride.status === "departed") {
    return (
      <ActionBar>
        <NoticeBar tone="neutral">
          Esta carona saiu às {formatTime(ride.departureAt)}. Não aceita mais contato.
        </NoticeBar>
        {back}
      </ActionBar>
    );
  }
  if (ride.status === "cancelled") {
    return (
      <ActionBar>
        <NoticeBar tone="critical">Esta carona foi cancelada. Ela não sai mais.</NoticeBar>
        {back}
      </ActionBar>
    );
  }
  if (contacting.contact !== null) {
    return (
      <ActionBar hint="Combine o ponto e o pagamento pela conversa.">
        <a
          href={contacting.contact.whatsappUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-target items-center justify-center gap-2 rounded-button bg-brand text-body font-semibold text-on-brand"
        >
          <Icon name="chat" />
          Falar no WhatsApp
        </a>
      </ActionBar>
    );
  }
  if (session.status === "anonymous" && acceptsContact) {
    return (
      <ActionBar>
        <Link
          to="/entrar"
          className="inline-flex min-h-target items-center justify-center rounded-button bg-brand text-body font-semibold text-on-brand"
        >
          Entrar para pedir contato
        </Link>
      </ActionBar>
    );
  }
  if (ride.actions.canContact) {
    return (
      <ActionBar
        hint={
          error === null ? "Você vê o WhatsApp e a placa. O pedido fica registrado." : undefined
        }
      >
        {error === null ? null : (
          <NoticeBar tone="caution" role="alert">
            {error}
          </NoticeBar>
        )}
        <ActionButton
          emphasis="primary"
          icon={<Icon name="phone" />}
          busy={contacting.busy}
          onPress={() => {
            setError(null);
            contacting.request().catch((reason: unknown) => {
              setError(reasonOf(reason));
            });
          }}
        >
          Pedir contato
        </ActionButton>
      </ActionBar>
    );
  }
  return null;
}

interface OriginMessageCardProps {
  readonly message: OriginMessage;
  readonly mine: boolean;
}

/** The words this record came from, as posted, in a chat bubble (S06; personal data redacted, D-128). */
function OriginMessageCard({ message, mine }: OriginMessageCardProps) {
  return (
    <Card>
      <h2 className="text-label font-bold tracking-[0.08em] text-ink-3 uppercase">
        {mine ? "Sua mensagem no grupo" : "Mensagem original"}
      </h2>
      <blockquote className="rounded-[20px] rounded-bl-[6px] bg-surface-2 px-4 py-3.5 text-base leading-[1.5] whitespace-pre-line text-ink">
        {message.text}
      </blockquote>
      <p className="text-caption text-ink-3">
        {message.groupLabel} · {formatDay(message.sentAt)} às {formatTime(message.sentAt)}
      </p>
      {mine ? null : (
        <p className="text-caption text-ink-3">O BrazCar esconde telefones e placas da mensagem.</p>
      )}
    </Card>
  );
}

interface OwnerPanelProps {
  readonly ride: Ride;
  readonly actions: RideActions;
  readonly onRepeated: (ride: Ride) => void;
}

/** The driver's own ride: seats up top, then the other actions with their consequence (S05). */
function OwnerPanel({ ride, actions, onRepeated }: OwnerPanelProps) {
  const [error, setError] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [repeatOpen, setRepeatOpen] = useState(false);
  const fail = (reason: unknown) => {
    setError(reasonOf(reason));
  };
  const allowed = ride.actions;
  return (
    <section aria-labelledby="owner-heading" className="flex flex-col gap-4">
      <h2 id="owner-heading" className="sr-only">
        Sua carona
      </h2>
      {ride.origin === "whatsapp" ? (
        <NoticeBar tone="info">
          Veio do seu anúncio no grupo {ride.originMessage?.groupLabel ?? "de WhatsApp"}. Daqui em
          diante, ajuste por aqui.
        </NoticeBar>
      ) : null}
      {ride.status === "cancelled" ? (
        <NoticeBar tone="critical">
          Você cancelou esta carona. Ela saiu do mural e não volta.
        </NoticeBar>
      ) : (
        <p className="text-secondary text-ink-2">
          {formatPrice(ride.price)}
          {ride.hasFares ? " a partir de" : ""} · {formatPayment(ride.paymentMethods)}
          {ride.car === null ? "" : ` · ${ride.car.model} ${ride.car.color}`}
        </p>
      )}
      {allowed.canChangeSeats ? (
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-body font-bold">Vagas livres</span>
              <span className="text-sm text-ink-2">
                {ride.seatsAvailable === 0
                  ? "Lotada. Ponha uma vaga para reabrir."
                  : "Zerar fecha a carona."}
              </span>
            </div>
            <Stepper
              label="Vagas"
              value={ride.seatsAvailable}
              min={0}
              max={MAX_SEATS}
              disabled={actions.busy}
              decreaseLabel="Tirar uma vaga"
              increaseLabel="Pôr uma vaga"
              onChange={(seats) => {
                void actions.changeSeats(seats).catch(fail);
              }}
            />
          </div>
        </Card>
      ) : null}
      <ListGroup>
        {allowed.canEdit ? (
          <ListRowLink
            to="/caronas/$rideId/editar"
            params={{ rideId: ride.id }}
            icon={<Icon name="edit" />}
            title="Editar"
            subtitle="O horário só muda no mesmo dia"
          />
        ) : null}
        {allowed.canRepeat ? (
          <ListRowButton
            icon={<Icon name="repeat" />}
            title={ride.status === "cancelled" ? "Repetir esta carona" : "Repetir"}
            subtitle={
              ride.status === "cancelled"
                ? "Mesma rota, carro, vagas e preço"
                : "Publica outra igual em outro horário"
            }
            leads
            onPress={() => {
              setRepeatOpen(true);
            }}
          />
        ) : null}
        {allowed.canCancel ? (
          <ListRowButton
            icon={<Icon name="x" />}
            title="Cancelar carona"
            tone="critical"
            disabled={actions.busy}
            onPress={() => {
              setCancelOpen(true);
            }}
          />
        ) : null}
      </ListGroup>
      {error === null ? null : (
        <NoticeBar tone="critical" role="alert">
          {error}
        </NoticeBar>
      )}
      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Cancelar esta carona?"
        description="Cancelar é definitivo. Se mudar de ideia, use “repetir” para publicar outra igual."
        confirmLabel="Cancelar carona"
        busy={actions.busy}
        icon={<Icon name="x" size={24} />}
        onConfirm={() => {
          setCancelOpen(false);
          void actions.cancel().catch(fail);
        }}
      />
      <RepeatSheet
        ride={ride}
        open={repeatOpen}
        onOpenChange={setRepeatOpen}
        busy={actions.busy}
        onRepeat={(departureAt) => {
          void actions.repeat(departureAt).then(
            (created) => {
              setRepeatOpen(false);
              onRepeated(created);
            },
            (reason: unknown) => {
              setRepeatOpen(false);
              fail(reason);
            },
          );
        }}
      />
    </section>
  );
}

interface RepeatSheetProps {
  readonly ride: Ride;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly busy: boolean;
  readonly onRepeat: (departureAt: string) => void;
}

/** One field: the new departure; the rest comes from the ride (S05). */
function RepeatSheet({ ride, open, onOpenChange, busy, onRepeat }: RepeatSheetProps) {
  // A day later on the board's own calendar (D-094), not the device's: the default offered here
  // must still land on tomorrow's board day for someone whose device is in another zone.
  const nextDay = addDays(new Date(ride.departureAt), 1);
  const [departure, setDeparture] = useState(toLocalInput(nextDay.toISOString()));
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Repetir carona"
      description="Mesma rota, carro, vagas e preço. Escolha só o novo horário."
    >
      <TextField
        label="Repetir esta carona em"
        type="datetime-local"
        value={departure}
        onChange={setDeparture}
      />
      <ActionButton
        emphasis="primary"
        disabled={departure === ""}
        busy={busy}
        onPress={() => {
          onRepeat(fromLocalInput(departure));
        }}
      >
        Repetir carona
      </ActionButton>
    </Sheet>
  );
}
