import {
  type DayCard,
  addDays,
  dateOf,
  dayCards,
  localDay,
  longWeekday,
} from "@/shared/app/calendar";

import type { Ride } from "../domain/ride";

/**
 * The board's day axis (S01): rides grouped by their local day, each group with the words the
 * section needs. Pure functions of a moment, so the screen never reads the clock by itself.
 */

export interface DaySection {
  /** "YYYY-MM-DD" in the device's zone, the same the `day` filter carries. */
  readonly day: string;
  /** "Hoje · quinta, 24", "Amanhã · sexta, 25", "Sábado, 26 de setembro". */
  readonly title: string;
  readonly rides: readonly Ride[];
  /** Today's section shows where "now" falls: before the first ride still to go. */
  readonly isToday: boolean;
}

export type DayChip = Pick<DayCard, "day" | "label">;

const dayMonthLong = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long" });
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** "Hoje · quinta, 24" for today and tomorrow; "Sábado, 26 de setembro" for any other day. */
export function dayTitle(day: string, now: Date): string {
  const date = dateOf(day);
  const weekday = longWeekday(date);
  if (day === localDay(now)) return `Hoje · ${weekday}, ${String(date.getDate())}`;
  if (day === localDay(addDays(now, 1))) return `Amanhã · ${weekday}, ${String(date.getDate())}`;
  return `${capitalize(weekday)}, ${dayMonthLong.format(date)}`;
}

/** Groups the list, already in departure order, by local day. */
export function groupByDay(rides: readonly Ride[], now: Date): readonly DaySection[] {
  const sections = new Map<string, Ride[]>();
  for (const ride of rides) {
    const day = localDay(new Date(ride.departureAt));
    const group = sections.get(day);
    if (group === undefined) sections.set(day, [ride]);
    else group.push(ride);
  }
  const today = localDay(now);
  return [...sections.entries()].map(([day, group]) => ({
    day,
    title: dayTitle(day, now),
    rides: group,
    isToday: day === today,
  }));
}

/** Today, tomorrow and the two days after, as the chip row offers them. */
export function dayChips(now: Date, count = 4): readonly DayChip[] {
  return dayCards(now, count).map(({ day, label }) => ({ day, label }));
}

const clock = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });

/** "Agora · 14:52". */
export function nowLabel(now: Date): string {
  return `Agora · ${clock.format(now)}`;
}
