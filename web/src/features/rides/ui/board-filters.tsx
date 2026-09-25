import { CheckboxField } from "@/shared/ui/checkbox-field";
import { TextField } from "@/shared/ui/text-field";

import type { BoardFilters } from "../domain/board";

interface BoardFiltersFormProps {
  readonly filters: BoardFilters;
  readonly onChange: (filters: BoardFilters) => void;
}

/** The board's filters. Every change goes straight to the caller, which keeps them in the URL.
 *
 * "A partir de" comes first: it will be the first chip once the design gives filters that shape.
 */
export function BoardFiltersForm({ filters, onChange }: BoardFiltersFormProps) {
  return (
    <section className="flex flex-col gap-3">
      <TextField
        label="A partir de"
        type="time"
        value={filters.fromTime ?? ""}
        onChange={(fromTime) => {
          onChange({ ...filters, fromTime: fromTime === "" ? null : fromTime });
        }}
        hint="Horário mínimo de partida, em cada data da lista ou só na marcada."
      />
      <TextField
        label="Passa por"
        type="search"
        value={filters.text ?? ""}
        onChange={(text) => {
          onChange({ ...filters, text: text === "" ? null : text });
        }}
        placeholder="Esplanada, Incra 8, Rodoviária…"
        hint="Qualquer parada: lugar do catálogo ou ponto que o motorista escreveu."
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
