import { useEffect, useRef } from "react";

import { Combobox } from "@/shared/ui/combobox";

import { usePlaceSearch } from "../app/use-place-search";
import type { Place } from "../domain/place";
import type { PlaceSearchStatus } from "../domain/place-search";

/** What the field holds: a catalog place, or free text typed instead of choosing one (D-123). */
export interface PlaceChoice {
  readonly place: Place | null;
  readonly text: string;
}

/**
 * Free text, told apart from a catalog `Place` by carrying no `id`. Handed to the underlying
 * combobox as its own selected value: left alone, Base UI reverts the input to the label of
 * whatever is selected once the field is left, and nothing selected means "". Telling it the free
 * text itself is the selection stops that revert from wiping out what was typed.
 */
interface FreeText {
  readonly text: string;
}

type Selection = Place | FreeText;

function isPlace(entry: Selection): entry is Place {
  return "id" in entry;
}

interface PlacePickerProps {
  readonly label: string;
  readonly value: PlaceChoice;
  readonly onChange: (choice: PlaceChoice) => void;
}

function notice(status: PlaceSearchStatus, found: number, query: string): string | undefined {
  if (status === "failed") return "Não foi possível carregar os lugares.";
  if (status === "loading" && found === 0) return "Carregando…";
  if (found === 0)
    return `Nenhum lugar do catálogo com "${query.trim()}"; vale como você escreveu.`;
  return undefined;
}

/** A place of the catalog, searched as the driver types; text that matches none is free text. */
export function PlacePicker({ label, value, onChange }: PlacePickerProps) {
  const search = usePlaceSearch();
  const selection: Selection | null =
    value.place ?? (value.text === "" ? null : { text: value.text });
  // A value that arrives from outside (a URL, a stored ride) must show its name in the input:
  // Base UI only writes the input for choices made in the list.
  const shown = useRef<string | null>(null);
  useEffect(() => {
    const name = value.place?.name ?? (value.text === "" ? null : value.text);
    if (name !== null && name !== shown.current) {
      shown.current = name;
      search.setQuery(name);
    }
  }, [value, search]);
  return (
    <Combobox<Selection>
      label={label}
      placeholder="Esplanada, Braz, Rodoviária… ou outro lugar"
      items={search.places}
      itemKey={(entry) => (isPlace(entry) ? entry.id : `free-text:${entry.text}`)}
      itemLabel={(entry) => (isPlace(entry) ? entry.name : entry.text)}
      value={selection}
      onValueChange={(entry) => {
        onChange(
          entry !== null && isPlace(entry) ? { place: entry, text: "" } : { place: null, text: "" },
        );
      }}
      inputValue={search.query}
      onInputValueChange={search.setQuery}
      onInputBlur={() => {
        const typed = search.query.trim();
        const current = value.place?.name ?? value.text;
        if (typed !== current) onChange({ place: null, text: typed });
      }}
      notice={notice(search.status, search.places.length, search.query)}
    />
  );
}
