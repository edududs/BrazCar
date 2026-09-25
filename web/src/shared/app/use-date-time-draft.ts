import { useState } from "react";

import { BOARD_UTC_OFFSET } from "@/shared/domain/board-time-zone";

import { type LocalDay, boardWallClock } from "./calendar";
import { type TimeDraft, formatClock, useTimeDraft } from "./use-time-draft";

export interface DateTimeDraft {
  readonly day: LocalDay;
  readonly time: TimeDraft;
  readonly setDay: (day: LocalDay) => void;
  /** The instant the draft names, as ISO with the board's own offset resolved (D-094). */
  readonly value: () => string;
}

/** The board's day and clock of an instant (D-094). */
export function splitInstant(iso: string): { day: LocalDay; clock: string } {
  const wall = boardWallClock(new Date(iso));
  return { day: wall.day, clock: formatClock(wall.hour, wall.minute) };
}

/** The instant of a day and clock read on the board's own zone (D-094). */
export function joinInstant(day: LocalDay, hour: number, minute: number): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return new Date(`${day}T${pad(hour)}:${pad(minute)}:00${BOARD_UTC_OFFSET}`).toISOString();
}

/**
 * A departure being chosen (F7): the day from cards or a calendar, the clock by plus and minus.
 * Hours step by one, minutes by five; the time draft keeps the clock valid.
 */
export function useDateTimeDraft(initial: string): DateTimeDraft {
  const start = splitInstant(initial);
  const [day, setDay] = useState<LocalDay>(start.day);
  const time = useTimeDraft(start.clock, 5);
  return {
    day,
    time,
    setDay,
    value: () => joinInstant(day, time.hour, time.minute),
  };
}
