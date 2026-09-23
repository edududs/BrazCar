/** The board's filters. They live in the URL (D-056), so every value is text or a flag. */
export interface BoardFilters {
  /** "YYYY-MM-DD" in the board's own day, or null for any day. */
  readonly day: string | null;
  /** "Passa por": any stop, a catalog place or "other", by text (D-101). */
  readonly text: string | null;
  readonly withSeats: boolean;
  /** Decimal as text, or null for any price. */
  readonly maxPrice: string | null;
}

export const noFilters: BoardFilters = {
  day: null,
  text: null,
  withSeats: false,
  maxPrice: null,
};

export type BoardStatus = "loading" | "ready" | "failed";
