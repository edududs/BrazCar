/** The colour of the sky at the departure: what the detail paints behind the time (F2). */
export type Sky = "dawn" | "day" | "dusk" | "night";

/**
 * Four bands of the local departure hour: dawn 04–08, day 08–17, dusk 17–20, night 20–04. The
 * instant carries its offset, so the hour is the board's own (D-094), read on the device.
 */
export function skyOf(departureAt: string): Sky {
  const hour = new Date(departureAt).getHours();
  if (hour >= 4 && hour < 8) return "dawn";
  if (hour >= 8 && hour < 17) return "day";
  if (hour >= 17 && hour < 20) return "dusk";
  return "night";
}
