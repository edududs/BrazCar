import {
  type SearchSchemaInput,
  createFileRoute,
  stripSearchParams,
  useNavigate,
} from "@tanstack/react-router";

import { useBoard } from "@/features/rides/app/use-board";
import { useBoardSignal } from "@/features/rides/app/use-board-signal";
import { type BoardFilters, noFilters } from "@/features/rides/domain/board";
import { BoardFiltersForm } from "@/features/rides/ui/board-filters";
import { RideList } from "@/features/rides/ui/ride-list";
import { PageShell } from "@/shared/ui/page-shell";

/** The board's filters as the URL carries them (D-056): `/?q=incra&day=2026-09-23&withSeats=true&maxPrice=7`. */
interface BoardSearch {
  readonly q: string | null;
  readonly day: string | null;
  readonly withSeats: boolean;
  readonly maxPrice: string | null;
}

const text = (value: unknown): string | null =>
  // The router parses search values as JSON, so "7" arrives as a number.
  typeof value === "number" || (typeof value === "string" && value !== "") ? String(value) : null;

const noSearch: BoardSearch = { q: null, day: null, withSeats: false, maxPrice: null };

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown> & SearchSchemaInput): BoardSearch => ({
    q: text(search.q),
    day: text(search.day),
    withSeats: search.withSeats === true || search.withSeats === "true",
    maxPrice: text(search.maxPrice),
  }),
  search: { middlewares: [stripSearchParams(noSearch)] }, // defaults stay out of the URL
  component: BoardPage,
});

function BoardPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const filters: BoardFilters = { ...noFilters, ...search, text: search.q };
  const board = useBoard(filters);
  useBoardSignal({ onChange: board.refresh });
  const filtering =
    filters.day !== null || filters.text !== null || filters.withSeats || filters.maxPrice !== null;

  return (
    <PageShell title="Caronas">
      <BoardFiltersForm
        filters={filters}
        onChange={(next) => {
          void navigate({
            to: "/",
            search: {
              q: next.text,
              day: next.day,
              withSeats: next.withSeats,
              maxPrice: next.maxPrice,
            },
            replace: true,
          });
        }}
      />
      <RideList
        rides={board.rides}
        status={board.status}
        emptyText={
          filtering ? "Nenhuma carona com esses filtros." : "Nenhuma carona publicada por enquanto."
        }
      />
    </PageShell>
  );
}
