import { useState } from "react";

import { type LocalDay, localDay } from "./calendar";
import { type TimeDraft, formatClock, useTimeDraft } from "./use-time-draft";

export interface DateTimeDraft {
  readonly day: LocalDay;
  readonly time: TimeDraft;
  readonly setDay: (day: LocalDay) => void;
  /** The instant the draft names, as ISO with the device's offset resolved. */
  readonly value: () => string;
}

/** The local day and clock of an instant. */
export function splitInstant(iso: string): { day: LocalDay; clock: string } {
  const at = new Date(iso);
  return { day: localDay(at), clock: formatClock(at.getHours(), at.getMinutes()) };
}

/** The instant of a local day and clock. */
export function joinInstant(day: LocalDay, hour: number, minute: number): string {
  const [year, month, dayNumber] = day.split("-").map(Number);
  return new Date(year ?? 0, (month ?? 1) - 1, dayNumber ?? 1, hour, minute).toISOString();
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
