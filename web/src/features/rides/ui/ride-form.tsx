import { useId, useState } from "react";

import type { Car } from "@/features/accounts/domain/account";
import { usePlace } from "@/features/places/app/use-place";
import { PlacePicker, type PlaceChoice } from "@/features/places/ui/place-picker";
import { useUnsavedWork } from "@/shared/app/unsaved-work";
import { ActionBar } from "@/shared/ui/action-bar";
import { ActionButton } from "@/shared/ui/action-button";
import { DateTimeField } from "@/shared/ui/date-time-field";
import { Form } from "@/shared/ui/form";
import { Icon } from "@/shared/ui/icon";
import { IconButton } from "@/shared/ui/icon-button";
import { NoticeBar } from "@/shared/ui/notice-bar";
import { SelectField } from "@/shared/ui/select-field";
import { Stepper } from "@/shared/ui/stepper";
import { SwitchField } from "@/shared/ui/switch-field";
import { TextAreaField } from "@/shared/ui/textarea-field";
import { TextField } from "@/shared/ui/text-field";
import { ToggleField } from "@/shared/ui/toggle-field";

import { type StopRole, useRouteDraft } from "../app/use-route-draft";
import {
  MAX_SEATS,
  NOTES_LIMIT,
  type PaymentMethod,
  type RideDraft,
  type StopDraft,
} from "../domain/ride";
import { formatPrice, paymentLabel } from "./format";
import { reasonOf } from "./reason";

interface RideFormProps {
  readonly initial: RideDraft;
  /** The driver's cars, to publish with. Absent when editing: the car is a snapshot (D-023). */
  readonly cars?: readonly Car[];
  readonly busy: boolean;
  readonly submitLabel: string;
  readonly onSubmit: (draft: RideDraft) => Promise<unknown>;
  /** The moment the day cards are counted from. */
  readonly now: Date;
  /** Editing before leaving: the day stays, only the hour moves (ADR-0004). */
  readonly dayLocked?: boolean;
  /** A line under the departure field, such as until when a delay may go. */
  readonly departureHint?: string;
}

const METHODS: readonly PaymentMethod[] = ["pix", "cash"];

/**
 * Publish or edit: the same fields, the same rules on the API (S07, S08). The route is drawn as
 * the ride's own line; the departure is chosen on a sheet; the one action sits on a fixed bar.
 */
export function RideForm({
  initial,
  cars,
  busy,
  submitLabel,
  onSubmit,
  now,
  dayLocked = false,
  departureHint,
}: RideFormProps) {
  useUnsavedWork(); // a new build asks before discarding what is typed here (D-052)
  const formId = useId();
  const [draft, setDraft] = useState<RideDraft>(initial);
  const [error, setError] = useState<string | null>(null);
  const route = useRouteDraft(initial.stops);
  const [faresOn, setFaresOn] = useState(route.hasFares);
  const set = <K extends keyof RideDraft>(key: K, value: RideDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const submit = () => {
    setError(null);
    const stops = faresOn ? route.value() : route.value().map((stop) => ({ ...stop, fare: "" }));
    onSubmit({ ...draft, stops }).catch((reason: unknown) => {
      setError(reasonOf(reason));
    });
  };
  const cheapest = faresOn ? route.cheapestFare : null;

  return (
    <>
      <Form id={formId} onSubmit={submit} error={error}>
        {cars === undefined ? null : (
          <SelectField
            label="Carro"
            prefix={<Icon name="car" />}
            value={draft.carId}
            onChange={(carId) => {
              set("carId", carId);
            }}
            options={cars.map((car) => ({ value: car.id, label: `${car.model} ${car.color}` }))}
            placeholder="Escolha o carro"
            required
          />
        )}
        <div className="flex flex-col gap-2">
          {/* The rows are the fieldset's own children: the route is one drawn line (S07). */}
          <fieldset className="flex flex-col rounded-card border border-line-soft bg-surface px-3 py-2 shadow-1">
            <legend className="float-left mb-2 text-secondary font-semibold text-ink">
              Trajeto
            </legend>
            {route.stops.map(({ key, role, stop }, index) => (
              <StopRow
                key={key}
                role={role}
                stop={stop}
                fares={faresOn}
                last={index === route.stops.length - 1}
                onChange={(changed) => {
                  route.change(key, changed);
                }}
                onRemove={() => {
                  route.remove(key);
                }}
                onAddBefore={role === "destination" ? route.addWaypoint : undefined}
              />
            ))}
          </fieldset>
          <SwitchField checked={faresOn} onChange={setFaresOn}>
            Preço diferente por parada
          </SwitchField>
          {route.hasFreeText ? (
            <p className="text-sm text-ink-3">
              Parada escrita por você aparece no mural como está e também é achada na busca.
            </p>
          ) : null}
        </div>
        <DateTimeField
          label="Saída"
          value={draft.departureAt}
          onChange={(departureAt) => {
            set("departureAt", departureAt);
          }}
          now={now}
          dayLocked={dayLocked}
          hint={departureHint}
        />
        {cars === undefined ? null : ( // seats change from the ride itself once published (ADR-0003)
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-secondary font-semibold text-ink">Vagas</span>
              <span className="text-caption text-ink-3">Pelo menos uma</span>
            </div>
            <Stepper
              label="Vagas"
              value={draft.seatsAvailable}
              min={1}
              max={MAX_SEATS}
              decreaseLabel="Tirar uma vaga"
              increaseLabel="Pôr uma vaga"
              onChange={(seats) => {
                set("seatsAvailable", seats);
              }}
            />
          </div>
        )}
        {faresOn ? ( // with fares, the price is the cheapest of them (D-131)
          <NoticeBar tone="neutral">
            Com preço por parada, a carona aparece no mural “a partir de{" "}
            <b className="text-ink">{cheapest === null ? "…" : formatPrice(cheapest)}</b>”, o menor
            deles.
          </NoticeBar>
        ) : (
          <TextField
            label="Preço"
            type="number"
            inputMode="decimal"
            min="0.01"
            step="0.01"
            prefix="R$"
            value={draft.price}
            onChange={(price) => {
              set("price", price);
            }}
            required
          />
        )}
        <ToggleField
          label="Pagamento"
          options={METHODS.map((method) => ({ value: method, label: paymentLabel[method] }))}
          value={draft.paymentMethods}
          onChange={(paymentMethods) => {
            set("paymentMethods", paymentMethods);
          }}
        />
        <TextAreaField
          label="Observações"
          optional
          value={draft.notes}
          onChange={(notes) => {
            set("notes", notes);
          }}
          maxLength={NOTES_LIMIT}
          placeholder="Ex.: levo mala pequena, aviso no grupo se atrasar."
          hint="Sem telefone, e-mail ou placa: o contato sai pelo botão."
        />
      </Form>
      <ActionBar>
        <ActionButton submit form={formId} emphasis="primary" busy={busy}>
          {submitLabel}
        </ActionButton>
      </ActionBar>
    </>
  );
}

interface StopRowProps {
  readonly role: StopRole;
  readonly stop: StopDraft;
  readonly fares: boolean;
  readonly last: boolean;
  readonly onChange: (stop: StopDraft) => void;
  readonly onRemove: () => void;
  /** On the destination row: the dashed "Parada no caminho" that inserts a stop above it. */
  readonly onAddBefore?: (() => void) | undefined;
}

const roleLabel = {
  origin: "Sai de",
  waypoint: "Parada no caminho",
  destination: "Vai para",
} as const satisfies Record<StopRole, string>;

/**
 * One stop on the drawn line: a dot, the place (a catalog place, or whatever text the driver typed
 * and did not choose from the list, D-123), and, past the first, what it costs to get there from
 * the origin when fares are on (D-131).
 */
function StopRow({ role, stop, fares, last, onChange, onRemove, onAddBefore }: StopRowProps) {
  const place = usePlace(stop.placeId);
  const dot =
    role === "origin"
      ? "size-3 border-ink bg-ink"
      : role === "destination"
        ? "size-3.5 border-brand bg-brand"
        : "size-3 border-ink-2 bg-surface";
  return (
    <div className="flex flex-col">
      {onAddBefore === undefined ? null : (
        <button
          type="button"
          aria-label="Adicionar parada no caminho"
          onClick={onAddBefore}
          className="relative flex min-h-12 items-center gap-2.5 pl-8 text-secondary font-semibold text-brand-ink before:absolute before:top-0 before:bottom-0 before:left-[9px] before:w-0.5 before:bg-[repeating-linear-gradient(var(--line-strong)_0_4px,transparent_4px_8px)]"
        >
          <Icon name="plus" size={16} />
          Parada no caminho
        </button>
      )}
      <div className="relative grid grid-cols-[22px_minmax(0,1fr)_auto] items-start gap-x-2.5 py-2">
        <span
          aria-hidden
          className={`absolute left-[9px] w-0.5 bg-line-strong ${role === "origin" ? "top-1/2" : "top-0"} ${last ? "bottom-1/2" : "bottom-0"}`}
        />
        <span
          aria-hidden
          className={`z-[1] mt-[38px] justify-self-center rounded-full border-[2.5px] ${dot}`}
        />
        <div className="flex min-w-0 flex-col gap-2">
          <PlacePicker
            label={roleLabel[role]}
            value={{ place, text: stop.text }}
            onChange={(choice: PlaceChoice) => {
              onChange({ ...stop, placeId: choice.place?.id ?? null, text: choice.text });
            }}
          />
          {role !== "origin" && fares ? (
            <TextField
              label="Preço até aqui"
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              prefix="R$"
              value={stop.fare}
              onChange={(fare) => {
                onChange({ ...stop, fare });
              }}
            />
          ) : null}
        </div>
        {role === "waypoint" ? (
          <div className="mt-[22px]">
            <IconButton icon="x" label="Remover parada" look="plain" onPress={onRemove} />
          </div>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}
