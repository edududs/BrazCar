/**
 * Days as the screens name them: the local calendar day of an instant, the cards "Hoje",
 * "Amanhã", "Sáb 26", and a month laid out in weeks. Pure functions of a moment, so no screen
 * reads the clock by itself.
 */

/** "YYYY-MM-DD" in the device's zone, the same the board's `day` filter carries (D-094). */
export type LocalDay = string;

export interface DayCard {
  readonly day: LocalDay;
  /** "Hoje", "Amanhã", "Sáb 26". */
  readonly label: string;
  /** "Hoje", "Amanhã", "Sáb"; the number goes big on the card. */
  readonly weekday: string;
  readonly number: number;
}

const pad = (n: number) => String(n).padStart(2, "0");

export function localDay(at: Date): LocalDay {
  return `${String(at.getFullYear())}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
}

/** Noon of a local day: safe from any daylight-saving edge. */
export function dateOf(day: LocalDay): Date {
  return new Date(`${day}T12:00:00`);
}

export function addDays(at: Date, days: number): Date {
  const next = new Date(at);
  next.setDate(next.getDate() + days);
  return next;
}

const weekdayShort = new Intl.DateTimeFormat("pt-BR", { weekday: "short" });
const weekdayLong = new Intl.DateTimeFormat("pt-BR", { weekday: "long" });
const dayMonthShort = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short" });
const dayMonthLong = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long" });
const monthYear = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const trimDot = (text: string) => text.replace(/\./g, "");

/** "Sáb" for a date. */
export function shortWeekday(at: Date): string {
  return capitalize(trimDot(weekdayShort.format(at)));
}

/** "quinta" for a date, without "-feira". */
export function longWeekday(at: Date): string {
  return weekdayLong.format(at).replace("-feira", "");
}

/** Today, tomorrow and the days after, as the cards and chips offer them. */
export function dayCards(now: Date, count = 4): readonly DayCard[] {
  return Array.from({ length: count }, (_, offset) => {
    const date = addDays(now, offset);
    const weekday = offset === 0 ? "Hoje" : offset === 1 ? "Amanhã" : shortWeekday(date);
    return {
      day: localDay(date),
      label: offset < 2 ? weekday : `${weekday} ${String(date.getDate())}`,
      weekday,
      number: date.getDate(),
    };
  });
}

/** "Qui, 24 set": the field's short form of a day. */
export function formatDayShort(day: LocalDay): string {
  const date = dateOf(day);
  return `${shortWeekday(date)}, ${trimDot(dayMonthShort.format(date)).replace(" de ", " ")}`;
}

/** "quinta, 24 de setembro": the sentence's form. */
export function formatDaySentence(day: LocalDay): string {
  const date = dateOf(day);
  return `${longWeekday(date)}, ${dayMonthLong.format(date)}`;
}

/** "hoje", "amanhã", or the day spelled out, for a sentence like "Sai hoje, às 19:00". */
export function relativeDay(day: LocalDay, now: Date): string {
  if (day === localDay(now)) return "hoje";
  if (day === localDay(addDays(now, 1))) return "amanhã";
  return formatDaySentence(day);
}

export interface MonthGrid {
  readonly year: number;
  /** 1 to 12. */
  readonly month: number;
  /** "Setembro de 2026". */
  readonly title: string;
  /** Rows of seven, Sunday first; `null` where the month has no day. */
  readonly weeks: readonly (readonly (LocalDay | null)[])[];
}

/** A month in weeks, for the calendar. */
export function monthGrid(year: number, month: number): MonthGrid {
  const first = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: (LocalDay | null)[] = Array.from({ length: first.getDay() }, () => null);
  for (let dayNumber = 1; dayNumber <= daysInMonth; dayNumber += 1) {
    cells.push(localDay(new Date(year, month - 1, dayNumber)));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = [];
  for (let at = 0; at < cells.length; at += 7) weeks.push(cells.slice(at, at + 7));
  return { year, month, title: capitalize(monthYear.format(first)), weeks };
}

/** The month after, or before, in the grid's own terms. */
export function shiftMonth(
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } {
  const date = new Date(year, month - 1 + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}
