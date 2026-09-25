import { useState } from "react";

import { formatClock } from "@/shared/app/use-time-draft";
import { Chip, ChipRow } from "@/shared/ui/chip";
import { Icon } from "@/shared/ui/icon";
import { SearchField } from "@/shared/ui/search-field";

import { dayChips } from "../app/board-days";
import type { BoardFilters } from "../domain/board";
import { PriceSheet } from "./price-sheet";
import { TimeSheet } from "./time-sheet";

interface BoardFiltersFormProps {
  readonly filters: BoardFilters;
  readonly onChange: (filters: BoardFilters) => void;
  /** The moment the chips are counted from: today, tomorrow, and "Agora" in the time sheet. */
  readonly now: Date;
  /** A line under the search that explains an alias, when one did the work (S02). */
  readonly note?: string | null;
}

/**
 * The board's filters: the search on top, then one row of chips. "A partir de" comes first,
 * because the hour is the product's axis (S01); active chips move to the front. Every change
 * goes straight to the caller, which keeps them in the URL (D-056).
 */
export function BoardFiltersForm({ filters, onChange, now, note = null }: BoardFiltersFormProps) {
  const [timeOpen, setTimeOpen] = useState(false);
  const [priceOpen, setPriceOpen] = useState(false);
  const set = (patch: Partial<BoardFilters>) => {
    onChange({ ...filters, ...patch });
  };

  const chips = [
    {
      key: "from",
      active: filters.fromTime !== null,
      node: (
        <Chip
          key="from"
          pressed={filters.fromTime !== null}
          dashed
          clears
          icon={<Icon name="clock" size={16} />}
          onPress={() => {
            if (filters.fromTime === null) setTimeOpen(true);
            else set({ fromTime: null });
          }}
        >
          {filters.fromTime === null ? "A partir de" : `A partir de ${filters.fromTime}`}
        </Chip>
      ),
    },
    ...dayChips(now).map((chip) => ({
      key: chip.day,
      active: filters.day === chip.day,
      node: (
        <Chip
          key={chip.day}
          pressed={filters.day === chip.day}
          onPress={() => {
            set({ day: filters.day === chip.day ? null : chip.day });
          }}
        >
          {chip.label}
        </Chip>
      ),
    })),
    {
      key: "seats",
      active: filters.withSeats,
      node: (
        <Chip
          key="seats"
          pressed={filters.withSeats}
          dashed
          icon={filters.withSeats ? <Icon name="check" size={16} /> : undefined}
          onPress={() => {
            set({ withSeats: !filters.withSeats });
          }}
        >
          Com vaga
        </Chip>
      ),
    },
    {
      key: "price",
      active: filters.maxPrice !== null,
      node: (
        <Chip
          key="price"
          pressed={filters.maxPrice !== null}
          dashed
          clears
          onPress={() => {
            if (filters.maxPrice === null) setPriceOpen(true);
            else set({ maxPrice: null });
          }}
        >
          {filters.maxPrice === null ? "Até R$" : `Até R$ ${filters.maxPrice}`}
        </Chip>
      ),
    },
  ];
  const ordered = [...chips.filter((chip) => chip.active), ...chips.filter((chip) => !chip.active)];

  return (
    <section className="flex flex-col gap-3">
      <SearchField
        label="Passa por"
        value={filters.text ?? ""}
        onChange={(text) => {
          set({ text: text === "" ? null : text });
        }}
        placeholder="Passa por… Esplanada, Incra 8, SIA"
      />
      {note === null ? null : <p className="-mt-1.5 text-caption text-ink-3">{note}</p>}
      <ChipRow>{ordered.map((chip) => chip.node)}</ChipRow>
      <TimeSheet
        open={timeOpen}
        onOpenChange={setTimeOpen}
        value={filters.fromTime}
        now={formatClock(now.getHours(), now.getMinutes())}
        onApply={(fromTime) => {
          set({ fromTime });
        }}
      />
      <PriceSheet
        open={priceOpen}
        onOpenChange={setPriceOpen}
        value={filters.maxPrice}
        onApply={(maxPrice) => {
          set({ maxPrice });
        }}
      />
    </section>
  );
}
