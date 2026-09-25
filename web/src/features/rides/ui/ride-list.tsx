import type { ReactNode } from "react";

import { useClock } from "@/shared/app/use-clock";
import { EmptyState } from "@/shared/ui/empty-state";
import { SectionHeading } from "@/shared/ui/section-heading";

import { groupByDay, nowLabel } from "../app/board-days";
import { useFreshRides } from "../app/use-fresh-rides";
import type { BoardStatus } from "../domain/board";
import type { Ride, Stop } from "../domain/ride";
import { RideCard } from "./ride-card";

interface RideListProps {
  readonly rides: readonly Ride[];
  readonly status: BoardStatus;
  /** The empty state's title. */
  readonly emptyText: string;
  /** What the empty state says under the title, and offers. */
  readonly emptyDetail?: ReactNode;
  readonly emptyAction?: ReactNode;
  /**
   * `day`: the board, sections by day with the "Agora" mark in today's (S01).
   * `mine`: the driver's own, what is still to leave and what is over (S09).
   */
  readonly grouping?: "day" | "mine";
  readonly matched?: ((stop: Stop) => boolean) | undefined;
}

/** A list of cards with its three quiet states: loading, failed, nothing to show. */
export function RideList({
  rides,
  status,
  emptyText,
  emptyDetail,
  emptyAction,
  grouping = "day",
  matched,
}: RideListProps) {
  const now = useClock();
  const fresh = useFreshRides(rides, { ready: status === "ready" });
  if (status === "failed") {
    return <p className="text-secondary text-critical">Não foi possível carregar as caronas.</p>;
  }
  if (status === "loading" && rides.length === 0) {
    return <p className="text-secondary text-ink-2">Carregando…</p>;
  }
  if (rides.length === 0) {
    return (
      <EmptyState title={emptyText} action={emptyAction}>
        {emptyDetail}
      </EmptyState>
    );
  }
  const sections =
    grouping === "day"
      ? groupByDay(rides, now).map((section) => ({
          key: section.day,
          title: section.title,
          rides: section.rides,
          now: section.isToday,
          showDay: false,
        }))
      : splitMine(rides);
  return (
    <div className="flex flex-col gap-2.5">
      {sections.map((section) => (
        <section key={section.key} className="flex flex-col gap-2.5">
          <SectionHeading aside={countLabel(section.rides.length)}>{section.title}</SectionHeading>
          {section.now ? <NowMark label={nowLabel(now)} /> : null}
          <ul className="flex flex-col gap-2.5">
            {section.rides.map((ride) => (
              <li key={ride.id}>
                <RideCard
                  ride={ride}
                  showDay={section.showDay}
                  fresh={fresh.has(ride.id)}
                  matched={matched}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function countLabel(count: number): string {
  return count === 1 ? "1 carona" : `${String(count)} caronas`;
}

/** The driver's list: still to leave, in order, then what is over (S09). */
function splitMine(rides: readonly Ride[]) {
  const over = (ride: Ride) => ride.status === "cancelled" || ride.status === "departed";
  const upcoming = rides.filter((ride) => !over(ride)).reverse();
  const finished = rides.filter(over);
  return [
    { key: "upcoming", title: "Próximas", rides: upcoming, now: false, showDay: true },
    { key: "finished", title: "Encerradas", rides: finished, now: false, showDay: true },
  ].filter((section) => section.rides.length > 0);
}

/** "Agora · 14:52" in dawn: the only amber on the board, and only ever about time (F2). */
function NowMark({ label }: { readonly label: string }) {
  return (
    <p className="flex items-center gap-2.5 text-caption font-bold tabular-nums text-sun-ink">
      <span aria-hidden className="size-2 shrink-0 rounded-full bg-sun ring-4 ring-sun-soft" />
      {label}
      <span
        aria-hidden
        className="h-0.5 flex-1 rounded-sm bg-[linear-gradient(90deg,var(--sun),transparent_85%)]"
      />
    </p>
  );
}
