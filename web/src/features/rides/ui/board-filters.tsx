import { usePlace } from "@/features/places/app/use-place";
import { PlacePicker } from "@/features/places/ui/place-picker";
import { CheckboxField } from "@/shared/ui/checkbox-field";
import { TextField } from "@/shared/ui/text-field";

import type { BoardFilters } from "../domain/board";

interface BoardFiltersFormProps {
  readonly filters: BoardFilters;
  readonly onChange: (filters: BoardFilters) => void;
}

/** The board's filters. Every change goes straight to the caller, which keeps them in the URL. */
export function BoardFiltersForm({ filters, onChange }: BoardFiltersFormProps) {
  const place = usePlace(filters.placeId);
  return (
    <section className="flex flex-col gap-3">
      <PlacePicker
        label="Passa por"
        value={place}
        onChange={(chosen) => {
          onChange({ ...filters, placeId: chosen?.id ?? null });
        }}
      />
      <div className="grid grid-cols-2 gap-3">
        <TextField
          label="Dia"
          type="date"
          value={filters.day ?? ""}
          onChange={(day) => {
            onChange({ ...filters, day: day === "" ? null : day });
          }}
        />
        <TextField
          label="Preço até"
          type="number"
          inputMode="decimal"
          min="0"
          step="0.5"
          placeholder="R$"
          value={filters.maxPrice ?? ""}
          onChange={(maxPrice) => {
            onChange({ ...filters, maxPrice: maxPrice === "" ? null : maxPrice });
          }}
        />
      </div>
      <CheckboxField
        checked={filters.withSeats}
        onChange={(withSeats) => {
          onChange({ ...filters, withSeats });
        }}
      >
        Só com vaga
      </CheckboxField>
    </section>
  );
}
