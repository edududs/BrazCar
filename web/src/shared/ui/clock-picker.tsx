import { useRef } from "react";

import { useNumberSegment } from "../app/use-number-segment";
import { type TimeDraft, formatClock } from "../app/use-time-draft";
import { Icon } from "./icon";

interface ClockPickerProps {
  readonly draft: TimeDraft;
  /** How many minutes a step moves: what the draft was made with. */
  readonly minuteStep: number;
}

const column = "grid h-11 w-[76px] place-items-center rounded-[12px] bg-surface-2 text-ink";
const digits =
  "w-[92px] appearance-none rounded-field bg-transparent text-center font-display text-[60px] leading-none font-bold tracking-[-0.045em] tabular-nums text-ink outline-none placeholder:text-ink-3 focus:bg-brand-soft focus:text-brand-ink aria-invalid:text-critical";

/**
 * The hour and the minutes, big, each with a plus and a minus; a tap on a number types it (F7).
 * Typing goes through `useNumberSegment`: two digits for the hour, then the minutes take focus.
 */
export function ClockPicker({ draft, minuteStep }: ClockPickerProps) {
  const minutesRef = useRef<HTMLInputElement>(null);
  const hour = useNumberSegment({
    value: draft.hour,
    max: 23,
    onCommit: (next) => {
      draft.set(formatClock(next, draft.minute));
    },
    onComplete: () => {
      minutesRef.current?.focus();
    },
  });
  const minute = useNumberSegment({
    value: draft.minute,
    max: 59,
    onCommit: (next) => {
      draft.set(formatClock(draft.hour, next));
    },
  });
  const minutesLabel = minuteStep === 1 ? "Um minuto" : `${String(minuteStep)} minutos`;
  return (
    <div
      role="group"
      aria-label="Relógio"
      className="flex items-center justify-center gap-2.5 py-1"
    >
      <div className="flex flex-col items-center gap-1.5">
        <button
          type="button"
          aria-label="Uma hora a mais"
          onClick={() => {
            draft.addHours(1);
          }}
          className={column}
        >
          <Icon name="plus" />
        </button>
        <input
          aria-label="Hora"
          inputMode="numeric"
          autoComplete="off"
          enterKeyHint="next"
          value={hour.text}
          placeholder={hour.placeholder}
          aria-invalid={hour.invalid || undefined}
          onFocus={hour.onFocus}
          onChange={(event) => {
            hour.onChange(event.target.value);
          }}
          onBlur={hour.onBlur}
          className={digits}
        />
        <button
          type="button"
          aria-label="Uma hora a menos"
          onClick={() => {
            draft.addHours(-1);
          }}
          className={column}
        >
          <Icon name="minus" />
        </button>
      </div>
      <span aria-hidden className="font-display text-[48px] leading-none font-bold text-ink-3">
        :
      </span>
      <div className="flex flex-col items-center gap-1.5">
        <button
          type="button"
          aria-label={`${minutesLabel} a mais`}
          onClick={() => {
            draft.addMinutes(1);
          }}
          className={column}
        >
          <Icon name="plus" />
        </button>
        <input
          ref={minutesRef}
          aria-label="Minutos"
          inputMode="numeric"
          autoComplete="off"
          enterKeyHint="done"
          value={minute.text}
          placeholder={minute.placeholder}
          aria-invalid={minute.invalid || undefined}
          onFocus={minute.onFocus}
          onChange={(event) => {
            minute.onChange(event.target.value);
          }}
          onBlur={minute.onBlur}
          className={digits}
        />
        <button
          type="button"
          aria-label={`${minutesLabel} a menos`}
          onClick={() => {
            draft.addMinutes(-1);
          }}
          className={column}
        >
          <Icon name="minus" />
        </button>
      </div>
    </div>
  );
}

interface QuickTimesProps {
  readonly options: readonly { readonly label: string; readonly value: string }[];
  readonly current: string;
  readonly onPick: (value: string) => void;
  /** Times that no longer make sense, like ones already past today. */
  readonly disabled?: (value: string) => boolean;
}

/** A row of the usual times, one press each. */
export function QuickTimes({ options, current, onPick, disabled = () => false }: QuickTimesProps) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {options.map((option) => {
        const on = option.value === current;
        return (
          <button
            key={option.label}
            type="button"
            aria-pressed={on}
            disabled={disabled(option.value)}
            onClick={() => {
              onPick(option.value);
            }}
            className={`min-h-[46px] rounded-[12px] border-[1.5px] text-base font-semibold tabular-nums disabled:opacity-[.35] ${
              on ? "border-brand bg-brand-soft text-brand-ink" : "border-line bg-surface text-ink"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
