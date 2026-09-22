import type { BoardStatus } from "../domain/board";
import type { Ride } from "../domain/ride";
import { RideCard } from "./ride-card";

interface RideListProps {
  readonly rides: readonly Ride[];
  readonly status: BoardStatus;
  readonly emptyText: string;
}

/** A list of cards with its three quiet states: loading, failed, nothing to show. */
export function RideList({ rides, status, emptyText }: RideListProps) {
  if (status === "failed") {
    return <p className="text-sm text-critical">Não foi possível carregar as caronas.</p>;
  }
  if (status === "loading" && rides.length === 0) {
    return <p className="text-sm opacity-70">Carregando…</p>;
  }
  if (rides.length === 0) {
    return <p className="text-sm opacity-70">{emptyText}</p>;
  }
  return (
    <ul className="flex flex-col gap-3">
      {rides.map((ride) => (
        <li key={ride.id}>
          <RideCard ride={ride} />
        </li>
      ))}
    </ul>
  );
}
