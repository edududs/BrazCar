import { useState } from "react";

import type { Car } from "@/features/accounts/domain/account";
import { usePlace } from "@/features/places/app/use-place";
import { PlacePicker } from "@/features/places/ui/place-picker";
import { ActionButton } from "@/shared/ui/action-button";
import { CheckboxField } from "@/shared/ui/checkbox-field";
import { Form } from "@/shared/ui/form";
import { SelectField } from "@/shared/ui/select-field";
import { TextField } from "@/shared/ui/text-field";

import type { PaymentMethod, RideDraft, StopDraft } from "../domain/ride";
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

const catalogStop: StopDraft = { placeId: null, text: "" };
const METHODS: readonly PaymentMethod[] = ["pix", "cash"];

/** Publish or edit: the same fields, the same rules on the API. The stop list is the route (D-013). */
export function RideForm({
  initial,
  cars,
  busy,
  submitLabel,
  onSubmit,
  departureHint,
}: RideFormProps) {
  const [draft, setDraft] = useState<RideDraft>(initial);
  const [departure, setDeparture] = useState(toLocalInput(initial.departureAt));
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof RideDraft>(key: K, value: RideDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };
  const setStop = (index: number, stop: StopDraft) => {
    set(
      "stops",
      draft.stops.map((current, i) => (i === index ? stop : current)),
    );
  };

  const submit = () => {
    setError(null);
    onSubmit({ ...draft, departureAt: fromLocalInput(departure) }).catch((reason: unknown) => {
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
        <legend className="text-sm font-medium">Paradas, na ordem</legend>
        {draft.stops.map((stop, index) => (
          <StopField
            key={index}
            index={index}
            stop={stop}
            removable={draft.stops.length > 2}
            onChange={(changed) => {
              setStop(index, changed);
            }}
            onRemove={() => {
              set(
                "stops",
                draft.stops.filter((_, i) => i !== index),
              );
            }}
          />
        ))}
        <ActionButton
          onPress={() => {
            set("stops", [...draft.stops, catalogStop]);
          }}
        >
          Adicionar parada
        </ActionButton>
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
        <TextField
          label="Vagas"
          type="number"
          inputMode="numeric"
          min={cars === undefined ? 0 : 1}
          max={8}
          value={String(draft.seatsAvailable)}
          onChange={(seats) => {
            set("seatsAvailable", Number(seats));
          }}
          required
        />
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
      <ActionButton submit emphasis="primary" disabled={busy}>
        {submitLabel}
      </ActionButton>
    </Form>
  );
}

interface StopFieldProps {
  readonly index: number;
  readonly stop: StopDraft;
  readonly removable: boolean;
  readonly onChange: (stop: StopDraft) => void;
  readonly onRemove: () => void;
}

/** One stop: a place of the catalog, or "other" as text. The switch between the two is the checkbox. */
function StopField({ index, stop, removable, onChange, onRemove }: StopFieldProps) {
  const [other, setOther] = useState(stop.placeId === null && stop.text !== "");
  const place = usePlace(stop.placeId);
  const label = `Parada ${String(index + 1)}`;
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-neutral-soft p-3">
      {other ? (
        <TextField
          label={label}
          value={stop.text}
          onChange={(text) => {
            onChange({ placeId: null, text });
          }}
          placeholder="Ex.: Incra 8, portão da escola"
          required
        />
      ) : (
        <PlacePicker
          label={label}
          value={place}
          onChange={(chosen) => {
            onChange({ placeId: chosen?.id ?? null, text: "" });
          }}
        />
      )}
      <div className="flex items-center justify-between">
        <CheckboxField
          checked={other}
          onChange={(checked) => {
            setOther(checked);
            onChange({ placeId: null, text: "" });
          }}
        >
          Outro lugar
        </CheckboxField>
        {removable ? <ActionButton onPress={onRemove}>Remover</ActionButton> : null}
      </div>
    </div>
  );
}
