import { useState } from "react";

export interface NumberSegment {
  /** What the input shows: what is being typed, or the committed value padded. */
  readonly text: string;
  /** The committed value, padded, to show as a hint while the field is emptied for typing. */
  readonly placeholder: string;
  /** True while the typed digits are not a value the segment takes, like "25" for an hour. */
  readonly invalid: boolean;
  readonly onFocus: () => void;
  readonly onChange: (raw: string) => void;
  readonly onBlur: () => void;
}

interface NumberSegmentOptions {
  readonly value: number;
  /** The largest value the segment takes: 23 for hours, 59 for minutes. */
  readonly max: number;
  /** Called with every value the typing reaches that the segment takes. */
  readonly onCommit: (value: number) => void;
  /** Called when the segment is full, to move on to the next one. */
  readonly onComplete?: () => void;
  /** How many digits the segment holds. */
  readonly width?: number;
}

const pad = (value: number, width: number) => String(value).padStart(width, "0");

/**
 * A number typed digit by digit, like the hour of a clock (F7). Focus empties the field so the
 * first digit replaces the value instead of joining it; every digit that makes a value in range
 * is committed at once, so the rest of the screen follows the typing; a full segment moves on;
 * leaving the field shows the committed value again, whatever was left half typed.
 *
 * The input is not reformatted while typing: that is what made "1" become "01" and the next digit
 * be refused.
 */
export function useNumberSegment({
  value,
  max,
  onCommit,
  onComplete,
  width = 2,
}: NumberSegmentOptions): NumberSegment {
  const [typed, setTyped] = useState<string | null>(null);
  const padded = pad(value, width);
  const invalid = typed !== null && typed !== "" && Number(typed) > max;
  return {
    text: typed ?? padded,
    placeholder: padded,
    invalid,
    onFocus: () => {
      setTyped("");
    },
    onChange: (raw) => {
      const digits = raw.replace(/\D/g, "").slice(-width);
      setTyped(digits);
      if (digits === "" || Number(digits) > max) return;
      onCommit(Number(digits));
      if (digits.length === width) onComplete?.();
    },
    onBlur: () => {
      setTyped(null);
    },
  };
}
