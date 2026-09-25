import { Link } from "@tanstack/react-router";
import { useState } from "react";

import type { Session } from "@/features/accounts/domain/session";
import { ActionButton } from "@/shared/ui/action-button";
import { Badge } from "@/shared/ui/badge";
import { Card } from "@/shared/ui/card";
import { ConfirmDialog } from "@/shared/ui/confirm-dialog";
import { TextField } from "@/shared/ui/text-field";

import type { RideActions } from "../app/use-ride";
import { MAX_SEATS, type OriginMessage, type Ride } from "../domain/ride";
import { ContactButton } from "./contact-button";
import {
  formatDay,
  formatPrice,
  formatRidePrice,
  formatSeats,
  formatTime,
  fromLocalInput,
  paymentLabel,
  toLocalInput,
} from "./format";
import { reasonOf } from "./reason";
import { StatusBadge } from "./status-badge";

interface RideDetailProps {
  readonly ride: Ride;
  readonly session: Session;
  readonly actions: RideActions;
  readonly onRepeated: (ride: Ride) => void;
}

/** One ride in full. Which buttons exist is the API's call (ADR-0011); this only draws them. */
export function RideDetail({ ride, session, actions, onRepeated }: RideDetailProps) {
  const [error, setError] = useState<string | null>(null);
  const fail = (reason: unknown) => {
    setError(reasonOf(reason));
  };
  const allowed = ride.actions;
  const anyDriverAction =
    allowed.canEdit || allowed.canChangeSeats || allowed.canCancel || allowed.canRepeat;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-xl font-semibold">
            {formatTime(ride.departureAt)}{" "}
            <span className="text-sm font-normal opacity-70">{formatDay(ride.departureAt)}</span>
          </span>
          <StatusBadge status={ride.status} />
        </div>
        <ol className="flex flex-col gap-1 text-sm">
          {ride.stops.map((stop, index) => (
            <li key={`${String(index)}-${stop.label}`} className="flex justify-between gap-3">
              <span>
                {index + 1}. {stop.label}
              </span>
              {stop.fare === null ? null : (
                <span className="opacity-70">{formatPrice(stop.fare)}</span>
              )}
            </li>
          ))}
        </ol>
        <p className="text-sm">
          {formatRidePrice(ride.price, ride.hasFares)} · {formatSeats(ride.seatsAvailable)} ·{" "}
          {ride.paymentMethods.map((method) => paymentLabel[method]).join(" ou ")}
        </p>
        {ride.notes === null ? null : <p className="text-sm whitespace-pre-line">{ride.notes}</p>}
        <p className="flex flex-wrap items-center gap-2 text-sm opacity-70">
          <span>
            {ride.driverName}
            {ride.car === null ? "" : ` · ${ride.car.model}, ${ride.car.color}`}
          </span>
          {ride.origin === "whatsapp" ? <Badge tone="accent">via WhatsApp</Badge> : null}
        </p>
      </Card>

      {ride.originMessage === null ? null : <OriginMessageCard message={ride.originMessage} />}

      {allowed.canContact ? <ContactButton rideId={ride.id} /> : null}
      {!ride.isMine &&
      session.status === "anonymous" &&
      (ride.status === "open" || ride.status === "reopened") ? (
        <p className="text-sm">
          <Link to="/entrar" className="underline">
            Entre
          </Link>{" "}
          para pedir o contato do motorista.
        </p>
      ) : null}

      {anyDriverAction ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Sua carona</h2>
          {allowed.canChangeSeats ? (
            <SeatsControl
              ride={ride}
              busy={actions.busy}
              onChange={(seats) => {
                void actions.changeSeats(seats).catch(fail);
              }}
            />
          ) : null}
          <div className="flex flex-wrap gap-2">
            {allowed.canEdit ? (
              <Link
                to="/caronas/$rideId/editar"
                params={{ rideId: ride.id }}
                className="flex min-h-11 items-center rounded-lg bg-neutral-soft px-4 text-sm font-medium"
              >
                Editar
              </Link>
            ) : null}
            {allowed.canCancel ? (
              <CancelControl
                busy={actions.busy}
                onCancel={() => {
                  void actions.cancel().catch(fail);
                }}
              />
            ) : null}
          </div>
          {allowed.canRepeat ? (
            <RepeatControl
              ride={ride}
              busy={actions.busy}
              onRepeat={(departureAt) => {
                void actions.repeat(departureAt).then(onRepeated, fail);
              }}
            />
          ) : null}
          {error === null ? null : (
            <p role="alert" className="rounded-lg bg-critical-soft px-3 py-2 text-sm text-critical">
              {error}
            </p>
          )}
        </section>
      ) : null}
    </div>
  );
}

interface OriginMessageCardProps {
  readonly message: OriginMessage;
}

/** The words this record came from, as posted (personal data already redacted, D-128). */
function OriginMessageCard({ message }: OriginMessageCardProps) {
  return (
    <Card>
      <h2 className="text-sm font-semibold">Mensagem original</h2>
      <blockquote className="text-sm whitespace-pre-line">{message.text}</blockquote>
      <p className="text-xs opacity-70">
        {message.groupLabel} · {formatDay(message.sentAt)} {formatTime(message.sentAt)}
      </p>
    </Card>
  );
}

interface SeatsControlProps {
  readonly ride: Ride;
  readonly busy: boolean;
  readonly onChange: (seats: number) => void;
}

/** Zero closes the ride, back above zero reopens it: the API decides, the buttons only ask (ADR-0003). */
function SeatsControl({ ride, busy, onChange }: SeatsControlProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm">Vagas</span>
      <ActionButton
        disabled={busy || ride.seatsAvailable === 0}
        onPress={() => {
          onChange(ride.seatsAvailable - 1);
        }}
      >
        −
      </ActionButton>
      <span className="min-w-6 text-center text-lg font-semibold">{ride.seatsAvailable}</span>
      <ActionButton
        disabled={busy || ride.seatsAvailable >= MAX_SEATS}
        onPress={() => {
          onChange(ride.seatsAvailable + 1);
        }}
      >
        +
      </ActionButton>
      {ride.seatsAvailable === 0 ? <span className="text-sm opacity-70">lotou</span> : null}
    </div>
  );
}

interface CancelControlProps {
  readonly busy: boolean;
  readonly onCancel: () => void;
}

function CancelControl({ busy, onCancel }: CancelControlProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <ActionButton
        emphasis="critical"
        disabled={busy}
        onPress={() => {
          setOpen(true);
        }}
      >
        Cancelar carona
      </ActionButton>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Cancelar esta carona?"
        description="Cancelar é definitivo. Se mudar de ideia, use “repetir” para publicar outra igual."
        confirmLabel="Cancelar carona"
        busy={busy}
        onConfirm={() => {
          setOpen(false);
          onCancel();
        }}
      />
    </>
  );
}

interface RepeatControlProps {
  readonly ride: Ride;
  readonly busy: boolean;
  readonly onRepeat: (departureAt: string) => void;
}

function RepeatControl({ ride, busy, onRepeat }: RepeatControlProps) {
  const nextDay = new Date(ride.departureAt);
  nextDay.setDate(nextDay.getDate() + 1);
  const [departure, setDeparture] = useState(toLocalInput(nextDay.toISOString()));
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-neutral-soft p-3">
      <TextField
        label="Repetir esta carona em"
        type="datetime-local"
        value={departure}
        onChange={setDeparture}
      />
      <ActionButton
        disabled={busy || departure === ""}
        onPress={() => {
          onRepeat(fromLocalInput(departure));
        }}
      >
        Repetir carona
      </ActionButton>
    </div>
  );
}
