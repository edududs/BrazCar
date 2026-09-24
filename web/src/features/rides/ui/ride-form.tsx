import { useState } from "react";

import type { Car } from "@/features/accounts/domain/account";
import { usePlace } from "@/features/places/app/use-place";
import { PlacePicker, type PlaceChoice } from "@/features/places/ui/place-picker";
import { useUnsavedWork } from "@/shared/app/unsaved-work";
import { ActionButton } from "@/shared/ui/action-button";
import { CheckboxField } from "@/shared/ui/checkbox-field";
import { Form } from "@/shared/ui/form";
import { SelectField } from "@/shared/ui/select-field";
import { TextAreaField } from "@/shared/ui/textarea-field";
import { TextField } from "@/shared/ui/text-field";

import { type StopRole, useRouteDraft } from "../app/use-route-draft";
import { NOTES_LIMIT, type PaymentMethod, type RideDraft, type StopDraft } from "../domain/ride";
import { fromLocalInput, paymentLabel, toLocalInput } from "./format";
import { reasonOf } from "./reason";

interface RideFormProps {
  readonly initial: RideDraft;
  /** The driver's cars, to publish with. Absent when editing: the car is a snapshot (D-023). */
  readonly cars?: readonly Car[];
  readonly busy: boolean;
  readonly submitLabel: string;
  readonly onSubmit: (draft: RideDraft) => Promise<unknown>;
  /** A line under the departure field, such as until when a delay may go. */
  readonly departureHint?: string;
}

const METHODS: readonly PaymentMethod[] = ["pix", "cash"];

/** Publish or edit: the same fields, the same rules on the API. Origin, stops on the way, destination. */
export function RideForm({
  initial,
  cars,
  busy,
  submitLabel,
  onSubmit,
  departureHint,
}: RideFormProps) {
  useUnsavedWork(); // a new build asks before discarding what is typed here (D-052)
  const [draft, setDraft] = useState<RideDraft>(initial);
  const [departure, setDeparture] = useState(toLocalInput(initial.departureAt));
  const [error, setError] = useState<string | null>(null);
  const route = useRouteDraft(initial.stops);
  const set = <K extends keyof RideDraft>(key: K, value: RideDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const submit = () => {
    setError(null);
    const ride = { ...draft, stops: route.value(), departureAt: fromLocalInput(departure) };
    onSubmit(ride).catch((reason: unknown) => {
      setError(reasonOf(reason));
    });
  };

  return (
    <Form onSubmit={submit} error={error}>
      {cars === undefined ? null : (
        <SelectField
          label="Carro"
          value={draft.carId}
          onChange={(carId) => {
            set("carId", carId);
          }}
          options={cars.map((car) => ({ value: car.id, label: `${car.model}, ${car.color}` }))}
          placeholder="Escolha o carro"
          required
        />
      )}
      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-medium">Trajeto</legend>
        {route.stops.map(({ key, role, stop }) => (
          <StopField
            key={key}
            role={role}
            stop={stop}
            onChange={(changed) => {
              route.change(key, changed);
            }}
            onRemove={() => {
              route.remove(key);
            }}
          />
        ))}
        <ActionButton onPress={route.addWaypoint}>Adicionar parada no caminho</ActionButton>
        <p className="text-xs font-normal opacity-70">
          Se cada parada tem um preço, preencha o preço de cada uma. A carona passa a valer “a
          partir de” o menor deles.
        </p>
      </fieldset>
      <TextField
        label="Saída"
        type="datetime-local"
        value={departure}
        onChange={setDeparture}
        hint={departureHint}
        required
      />
      <div className="grid grid-cols-2 gap-3">
        {cars === undefined ? null : ( // seats change from the ride itself once published (ADR-0003)
          <TextField
            label="Vagas"
            type="number"
            inputMode="numeric"
            min={1}
            max={8}
            value={String(draft.seatsAvailable)}
            onChange={(seats) => {
              set("seatsAvailable", Number(seats));
            }}
            required
          />
        )}
        {route.hasFares ? null : ( // with fares, the price is the cheapest of them (D-131)
          <TextField
            label="Preço"
            type="number"
            inputMode="decimal"
            min="0.01"
            step="0.01"
            value={draft.price}
            onChange={(price) => {
              set("price", price);
            }}
            required
          />
        )}
      </div>
      <fieldset className="flex flex-col">
        <legend className="text-sm font-medium">Pagamento</legend>
        {METHODS.map((method) => (
          <CheckboxField
            key={method}
            checked={draft.paymentMethods.includes(method)}
            onChange={(checked) => {
              set(
                "paymentMethods",
                checked
                  ? [...draft.paymentMethods, method]
                  : draft.paymentMethods.filter((m) => m !== method),
              );
            }}
          >
            {paymentLabel[method]}
          </CheckboxField>
        ))}
      </fieldset>
      <TextAreaField
        label="Observações"
        value={draft.notes}
        onChange={(notes) => {
          set("notes", notes);
        }}
        maxLength={NOTES_LIMIT}
        placeholder="Ex.: levo mala pequena, aviso no grupo se atrasar."
        hint="Sem telefone, e-mail ou placa: o contato sai pelo botão."
      />
      <ActionButton submit emphasis="primary" disabled={busy}>
        {submitLabel}
      </ActionButton>
    </Form>
  );
}

interface StopFieldProps {
  readonly role: StopRole;
  readonly stop: StopDraft;
  readonly onChange: (stop: StopDraft) => void;
  readonly onRemove: () => void;
}

const roleLabel = {
  origin: "Sai de",
  waypoint: "Parada no caminho",
  destination: "Vai para",
} as const satisfies Record<StopRole, string>;

/** One stop: a place of the catalog, or whatever text the driver typed and did not choose from
 * the list (D-123). Every stop but the first may say what it costs to get there from the origin
 * (D-131). */
function StopField({ role, stop, onChange, onRemove }: StopFieldProps) {
  const place = usePlace(stop.placeId);
  const label = roleLabel[role];
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-neutral-soft p-3">
      <PlacePicker
        label={label}
        value={{ place, text: stop.text }}
        onChange={(choice: PlaceChoice) => {
          onChange({ ...stop, placeId: choice.place?.id ?? null, text: choice.text });
        }}
      />
      {role === "origin" ? null : (
        <TextField
          label="Preço até aqui"
          type="number"
          inputMode="decimal"
          min="0.01"
          step="0.01"
          value={stop.fare}
          onChange={(fare) => {
            onChange({ ...stop, fare });
          }}
        />
      )}
      {role === "waypoint" ? (
        <div className="flex justify-end">
          <ActionButton onPress={onRemove}>Remover</ActionButton>
        </div>
      ) : null}
    </div>
  );
}
