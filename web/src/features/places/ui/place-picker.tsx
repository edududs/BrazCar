import { Combobox } from "@/shared/ui/combobox";

import { usePlaceSearch } from "../app/use-place-search";
import type { Place } from "../domain/place";
import type { PlaceSearchStatus } from "../domain/place-search";

interface PlacePickerProps {
  readonly label: string;
  readonly value: Place | null;
  readonly onChange: (place: Place | null) => void;
}

function notice(status: PlaceSearchStatus, found: number, query: string): string | undefined {
  if (status === "failed") return "Não foi possível carregar os lugares.";
  if (status === "loading" && found === 0) return "Carregando…";
  if (found === 0) return `Nenhum lugar com "${query.trim()}".`;
  return undefined;
}

export function PlacePicker({ label, value, onChange }: PlacePickerProps) {
  const search = usePlaceSearch();
  return (
    <Combobox
      label={label}
      placeholder="Esplanada, Braz, Rodoviária…"
      items={search.places}
      itemKey={(place) => place.id}
      itemLabel={(place) => place.name}
      value={value}
      onValueChange={onChange}
      inputValue={search.query}
      onInputValueChange={search.setQuery}
      notice={notice(search.status, search.places.length, search.query)}
    />
  );
}
