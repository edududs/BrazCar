import {
  Link,
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

const text = (value: unknown): string | null =>
  // The router parses search values as JSON, so "7" arrives as a number.
  typeof value === "number" || (typeof value === "string" && value !== "") ? String(value) : null;

/** The board. Its filters live in the URL (D-056): `/?placeId=plano-piloto&day=2026-09-23&withSeats=true&maxPrice=7`. */
export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown> & SearchSchemaInput): BoardFilters => ({
    day: text(search.day),
    placeId: text(search.placeId),
    withSeats: search.withSeats === true || search.withSeats === "true",
    maxPrice: text(search.maxPrice),
  }),
  search: { middlewares: [stripSearchParams(noFilters)] }, // defaults stay out of the URL
  component: BoardPage,
});

function BoardPage() {
  const filters = Route.useSearch();
  const navigate = useNavigate();
  const board = useBoard(filters);
  useBoardSignal({ onChange: board.refresh });
  const filtering =
    filters.day !== null ||
    filters.placeId !== null ||
    filters.withSeats ||
    filters.maxPrice !== null;

  return (
    <PageShell
      title="Caronas"
      actions={
        <>
          <Link to="/publicar" className="underline">
            Publicar
          </Link>
          <Link to="/minhas-caronas" className="underline">
            Minhas
          </Link>
          <Link to="/conta" className="underline">
            Conta
          </Link>
        </>
      }
    >
      <BoardFiltersForm
        filters={filters}
        onChange={(next) => {
          void navigate({ to: "/", search: { ...next }, replace: true });
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
