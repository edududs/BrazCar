import { Link } from "@tanstack/react-router";

interface BrandMarkProps {
  /** In pixels; the corner radius and the strokes scale with it. */
  readonly size?: 28 | 48 | 64;
}

/**
 * The symbol: two stops joined by a line, the ride reduced to its least, on a brand tile. The
 * same drawing as the app icon in `public/`, kept there by scripts/app-icons.mjs.
 */
export function BrandMark({ size = 28 }: BrandMarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className="shrink-0 text-brand">
      <rect width="64" height="64" rx="20" fill="currentColor" />
      <g className="text-on-brand" fill="currentColor" stroke="currentColor">
        <path d="M22 22 42 42" strokeWidth="4" strokeLinecap="round" />
        <circle cx="20.5" cy="20.5" r="6.5" stroke="none" />
        <circle cx="43.5" cy="43.5" r="6.5" stroke="none" />
      </g>
    </svg>
  );
}

/** The mark and the name, as a link to the board. */
export function Wordmark() {
  return (
    <Link
      to="/"
      className="flex min-h-11 items-center gap-2 font-display text-[22px] font-bold tracking-[-0.035em] text-ink"
    >
      <BrandMark />
      BrazCar
    </Link>
  );
}
