import { boardWallClock } from "@/shared/app/calendar";

/** The colour of the sky at the departure: what the detail paints behind the time (F2). */
export type Sky = "dawn" | "day" | "dusk" | "night";

/**
 * Four bands of the departure hour on the board's own clock (D-094): dawn 04–08, day 08–17,
 * dusk 17–20, night 20–04. Never the device's hour, which travels with whoever is looking.
 */
export function skyOf(departureAt: string): Sky {
  const hour = boardWallClock(new Date(departureAt)).hour;
  if (hour >= 4 && hour < 8) return "dawn";
  if (hour >= 8 && hour < 17) return "day";
  if (hour >= 17 && hour < 20) return "dusk";
  return "night";
}
