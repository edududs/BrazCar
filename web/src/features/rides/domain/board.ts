/** The board's filters. They live in the URL (D-056), so every value is text or a flag. */
export interface BoardFilters {
  /** "YYYY-MM-DD" in the board's own day, or null for any day. */
  readonly day: string | null;
  /** A place identifier; the API includes what is beneath it (D-083). */
  readonly placeId: string | null;
  readonly withSeats: boolean;
  /** Decimal as text, or null for any price. */
  readonly maxPrice: string | null;
}

export const noFilters: BoardFilters = {
  day: null,
  placeId: null,
  withSeats: false,
  maxPrice: null,
};

export type BoardStatus = "loading" | "ready" | "failed";
