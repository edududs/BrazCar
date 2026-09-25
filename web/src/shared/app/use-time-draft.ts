import { useState } from "react";

/** "HH:MM", the shape the board's `from` filter and the API take. */
export type Clock = `${string}:${string}`;

export interface TimeDraft {
  readonly hour: number;
  readonly minute: number;
  /** "HH:MM". */
  readonly value: Clock;
  readonly addHours: (delta: number) => void;
  readonly addMinutes: (delta: number) => void;
  readonly set: (value: string) => void;
}

const pad = (n: number) => String(n).padStart(2, "0");
const mod = (n: number, m: number) => ((n % m) + m) % m;

export function formatClock(hour: number, minute: number): Clock {
  return `${pad(hour)}:${pad(minute)}`;
}

export function parseClock(value: string): { hour: number; minute: number } | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (match === null) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour < 24 && minute < 60 ? { hour, minute } : null;
}

/**
 * A time being chosen with plus and minus (F7): hours wrap around the day, minutes step and
 * carry into the hour. What it holds is always a valid clock, whatever the taps.
 */
export function useTimeDraft(initial: string, minuteStep = 15): TimeDraft {
  const [state, setState] = useState(() => parseClock(initial) ?? { hour: 6, minute: 0 });
  const total = state.hour * 60 + state.minute;
  const setTotal = (minutes: number) => {
    const wrapped = mod(minutes, 24 * 60);
    setState({ hour: Math.floor(wrapped / 60), minute: wrapped % 60 });
  };
  return {
    hour: state.hour,
    minute: state.minute,
    value: formatClock(state.hour, state.minute),
    addHours: (delta) => {
      setTotal(total + delta * 60);
    },
    addMinutes: (delta) => {
      // From an odd minute, the first step lands on the grid.
      const snapped =
        delta > 0
          ? Math.floor(total / minuteStep) * minuteStep + minuteStep
          : Math.ceil(total / minuteStep) * minuteStep - minuteStep;
      setTotal(state.minute % minuteStep === 0 ? total + delta * minuteStep : snapped);
    },
    set: (value) => {
      const parsed = parseClock(value);
      if (parsed !== null) setState(parsed);
    },
  };
}
