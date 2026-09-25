import {
  type SearchSchemaInput,
  createFileRoute,
  stripSearchParams,
  useNavigate,
} from "@tanstack/react-router";

import { useBoard } from "@/features/rides/app/use-board";
import { useBoardMatch } from "@/features/rides/app/use-board-match";
import { useBoardSignal } from "@/features/rides/app/use-board-signal";
import { type BoardFilters, noFilters } from "@/features/rides/domain/board";
import { BoardFiltersForm } from "@/features/rides/ui/board-filters";
import { RideList } from "@/features/rides/ui/ride-list";
import { useClock } from "@/shared/app/use-clock";
import { ActionButton } from "@/shared/ui/action-button";
import { NoticeBar } from "@/shared/ui/notice-bar";
import { PageShell } from "@/shared/ui/page-shell";

/** The board's filters as the URL carries them (D-056): `/?q=incra&day=2026-09-23&withSeats=true&maxPrice=7&from=18:00`. */
interface BoardSearch {
  readonly q: string | null;
  readonly day: string | null;
  readonly withSeats: boolean;
  readonly maxPrice: string | null;
  /** "HH:MM", the departure's local hour at or after it (D-141). */
  readonly from: string | null;
  /** Landed here right after deleting the account: shows the notice once, then behaves like any filter. */
  readonly accountDeleted: boolean;
}

const text = (value: unknown): string | null =>
  // The router parses search values as JSON, so "7" arrives as a number.
  typeof value === "number" || (typeof value === "string" && value !== "") ? String(value) : null;

const noSearch: BoardSearch = {
  q: null,
  day: null,
  withSeats: false,
  maxPrice: null,
  from: null,
  accountDeleted: false,
};

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown> & SearchSchemaInput): BoardSearch => ({
    q: text(search.q),
    day: text(search.day),
    withSeats: search.withSeats === true || search.withSeats === "true",
    maxPrice: text(search.maxPrice),
    from: text(search.from),
    accountDeleted: search.accountDeleted === true || search.accountDeleted === "true",
  }),
  search: { middlewares: [stripSearchParams(noSearch)] }, // defaults stay out of the URL
  component: BoardPage,
});

function BoardPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const filters: BoardFilters = { ...noFilters, ...search, text: search.q, fromTime: search.from };
  const board = useBoard(filters);
  useBoardSignal({ onChange: board.refresh });
  const now = useClock();
  const match = useBoardMatch(filters.text);
  const filtering =
    filters.day !== null ||
    filters.text !== null ||
    filters.withSeats ||
    filters.maxPrice !== null ||
    filters.fromTime !== null;

  return (
    <PageShell title="Caronas" heading="brand">
      {search.accountDeleted ? (
        <NoticeBar>Conta excluída. As caronas dela saíram do mural.</NoticeBar>
      ) : null}
      <BoardFiltersForm
        filters={filters}
        now={now}
        note={match.note}
        onChange={(next) => {
          void navigate({
            to: "/",
            search: {
              q: next.text,
              day: next.day,
              withSeats: next.withSeats,
              maxPrice: next.maxPrice,
              from: next.fromTime,
              accountDeleted: false,
            },
            replace: true,
          });
        }}
      />
      {/* A filter change crosses the list in opacity with a small rise (F5): a new key remounts it. */}
      <div key={JSON.stringify(filters)} className="animate-list-in">
        <RideList
          rides={board.rides}
          status={board.status}
          matched={match.matches}
          emptyText={
            filtering
              ? "Nenhuma carona com esses filtros."
              : "Nenhuma carona publicada por enquanto."
          }
          emptyDetail={
            filtering
              ? "Os filtros estão escondendo as caronas. Se alguém publicar, ela aparece aqui."
              : "O mural atualiza sozinho: se alguém publicar, aparece aqui."
          }
          emptyAction={
            filtering ? (
              <ActionButton
                emphasis="quiet"
                onPress={() => {
                  void navigate({ to: "/", search: { ...noSearch }, replace: true });
                }}
              >
                Limpar filtros
              </ActionButton>
            ) : undefined
          }
        />
      </div>
    </PageShell>
  );
}
