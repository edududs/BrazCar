/** The board's filters. They live in the URL (D-056), so every value is text or a flag. */
export interface BoardFilters {
  /** "HH:MM" in the board's own zone: the departure's local hour at or after it (D-141).
   * Without `day`, judges every day of the list by its own local hour; with `day`, only that day. */
  readonly fromTime: string | null;
  /** "YYYY-MM-DD" in the board's own day, or null for any day. */
  readonly day: string | null;
  /** "Passa por": any stop, a catalog place or "other", by text (D-101). */
  readonly text: string | null;
  readonly withSeats: boolean;
  /** Decimal as text, or null for any price. */
  readonly maxPrice: string | null;
}

export const noFilters: BoardFilters = {
  fromTime: null,
  day: null,
  text: null,
  withSeats: false,
  maxPrice: null,
};

export type BoardStatus = "loading" | "ready" | "failed";
