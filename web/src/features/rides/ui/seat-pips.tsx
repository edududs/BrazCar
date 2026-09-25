import { MAX_SEATS } from "../domain/ride";

interface SeatPipsProps {
  readonly available: number;
  /** How many pips to draw: the seats the car had, when known; else the seats still free. */
  readonly total?: number;
  /** With the words: "3 vagas", "1 vaga", "Sem vaga". Off, just the number. */
  readonly wordy?: boolean;
}

function seatsLabel(seats: number, wordy: boolean): string {
  if (!wordy) return String(seats);
  if (seats === 0) return "Sem vaga";
  return seats === 1 ? "1 vaga" : `${String(seats)} vagas`;
}

/**
 * Seats as seats: one bar per place, green while free. Readable without colour, by count and by
 * shape, standing at the stop (F2). Never more than a car takes (D-142).
 */
export function SeatPips({ available, total, wordy = true }: SeatPipsProps) {
  const drawn = Math.min(Math.max(total ?? available, available, 1), MAX_SEATS);
  const free = Math.min(available, MAX_SEATS);
  return (
    <span className="flex items-center gap-[7px] text-sm font-semibold whitespace-nowrap text-ink">
      <span aria-hidden className="flex gap-[3px]">
        {Array.from({ length: drawn }, (_, index) => (
          <i
            key={index}
            className={`block h-3.5 w-[7px] rounded-[3px] ${index < free ? "bg-positive" : "bg-line-strong"}`}
          />
        ))}
      </span>
      {seatsLabel(available, wordy)}
    </span>
  );
}
