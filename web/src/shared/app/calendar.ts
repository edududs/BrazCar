import { BOARD_TIME_ZONE, BOARD_UTC_OFFSET } from "@/shared/domain/board-time-zone";

/**
 * Days as the screens name them: the board's calendar day of an instant (D-094), the cards
 * "Hoje", "Amanhã", "Sáb 26", and a month laid out in weeks. Pure functions of a moment, so no
 * screen reads the device's own clock or zone by itself.
 */

/** "YYYY-MM-DD" in the board's zone, the same the board's `day` filter carries (D-094). */
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

const wallClockParts = new Intl.DateTimeFormat("sv-SE", {
  timeZone: BOARD_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** The day, hour and minute an instant reads as on the board's own clock (D-094). */
export function boardWallClock(at: Date): { day: LocalDay; hour: number; minute: number } {
  const [datePart, timePart] = wallClockParts.format(at).split(" ");
  const [hour, minute] = (timePart ?? "00:00").split(":").map(Number);
  return { day: datePart ?? "1970-01-01", hour: hour ?? 0, minute: minute ?? 0 };
}

export function localDay(at: Date): LocalDay {
  return boardWallClock(at).day;
}

/** Noon of a local day, on the board's own clock: safe from any daylight-saving edge. */
export function dateOf(day: LocalDay): Date {
  return new Date(`${day}T12:00:00${BOARD_UTC_OFFSET}`);
}

/** A day later or earlier: exact, since the board's offset never shifts (no daylight saving). */
export function addDays(at: Date, days: number): Date {
  return new Date(at.getTime() + days * 86_400_000);
}

const weekdayShort = new Intl.DateTimeFormat("pt-BR", {
  weekday: "short",
  timeZone: BOARD_TIME_ZONE,
});
const weekdayLong = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  timeZone: BOARD_TIME_ZONE,
});
const dayMonthShort = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  month: "short",
  timeZone: BOARD_TIME_ZONE,
});
const dayMonthLong = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  month: "long",
  timeZone: BOARD_TIME_ZONE,
});
// Pinned to UTC on purpose: monthGrid below names a calendar month by its plain numbers, not an
// instant, so there is no board zone to read it in (see the comment there).
const monthYear = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

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
    const day = localDay(date);
    const number = Number(day.slice(8, 10));
    const weekday = offset === 0 ? "Hoje" : offset === 1 ? "Amanhã" : shortWeekday(date);
    return {
      day,
      label: offset < 2 ? weekday : `${weekday} ${String(number)}`,
      weekday,
      number,
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

/**
 * A month in weeks, for the calendar. Pure calendar math on the numbers given, with no instant
 * and so no zone to read: built on `Date.UTC` only so the weekday of day one and the days in the
 * month never depend on the device's own clock either.
 */
export function monthGrid(year: number, month: number): MonthGrid {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: (LocalDay | null)[] = Array.from({ length: first.getUTCDay() }, () => null);
  for (let dayNumber = 1; dayNumber <= daysInMonth; dayNumber += 1) {
    cells.push(`${String(year)}-${pad(month)}-${pad(dayNumber)}`);
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
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}
