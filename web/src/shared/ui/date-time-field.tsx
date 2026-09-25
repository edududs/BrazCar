import { useState } from "react";

import {
  type LocalDay,
  boardWallClock,
  dayCards,
  formatDayShort,
  localDay,
  monthGrid,
  relativeDay,
  shiftMonth,
} from "../app/calendar";
import { splitInstant, useDateTimeDraft } from "../app/use-date-time-draft";
import { ActionButton } from "./action-button";
import { ClockPicker, QuickTimes } from "./clock-picker";
import { FieldFrame } from "./field";
import { Icon } from "./icon";
import { Sheet } from "./sheet";

interface DateTimeFieldProps {
  readonly label: string;
  /** ISO instant. */
  readonly value: string;
  readonly onChange: (value: string) => void;
  /** The moment the day cards and "past" are counted from. */
  readonly now: Date;
  /** Editing before leaving: the day stays, only the hour moves (ADR-0004). */
  readonly dayLocked?: boolean;
  readonly hint?: string | undefined;
  readonly error?: string | null;
}

const QUICK = ["05:30", "06:00", "06:30", "07:00", "17:00", "17:30", "18:00", "19:00"] as const;

/**
 * When the ride leaves (F7): a field in two parts, the day and the hour, each opening the same
 * sheet. The days of the week are cards, "Outro dia" opens the calendar, the hour is big with
 * plus and minus, and a sentence repeats the choice before "Pronto". No wheel to spin.
 */
export function DateTimeField({
  label,
  value,
  onChange,
  now,
  dayLocked = false,
  hint,
  error = null,
}: DateTimeFieldProps) {
  const [open, setOpen] = useState<"day" | "time" | null>(null);
  const { day, clock } = splitInstant(value);
  const part =
    "flex min-h-[58px] items-center gap-2.5 rounded-field border-[1.5px] px-3.5 text-left text-body font-semibold text-ink";
  const state =
    error !== null
      ? "border-critical ring-4 ring-critical-ring"
      : "border-line-strong bg-surface focus-visible:border-brand focus-visible:ring-4 focus-visible:ring-ring";
  return (
    <>
      <FieldFrame label={label} hint={hint} error={error}>
        {(control) => (
          <div className="grid grid-cols-[minmax(0,1fr)_124px] gap-2">
            <button
              type="button"
              id={control.id}
              aria-describedby={control["aria-describedby"]}
              aria-invalid={control["aria-invalid"]}
              aria-label={
                dayLocked
                  ? `Dia: ${formatDayShort(day)}. Só muda a hora`
                  : `Dia: ${formatDayShort(day)}. Toque para trocar`
              }
              onClick={() => {
                setOpen("day");
              }}
              className={`${part} ${dayLocked ? "border-transparent bg-surface-2 text-ink-2" : state}`}
            >
              <span className="text-ink-3">
                <Icon name="cal" />
              </span>
              {formatDayShort(day)}
            </button>
            <button
              type="button"
              aria-label={`Hora: ${clock}. Toque para trocar`}
              onClick={() => {
                setOpen("time");
              }}
              className={`${part} justify-center font-display text-[24px] tracking-[-0.03em] tabular-nums ${state}`}
            >
              {clock}
            </button>
          </div>
        )}
      </FieldFrame>
      <Sheet
        open={open !== null}
        onOpenChange={(next) => {
          if (!next) setOpen(null);
        }}
        title={dayLocked ? "Novo horário" : "Quando você sai?"}
      >
        {open === null ? null : (
          <DateTimePicker
            initial={value}
            now={now}
            dayLocked={dayLocked}
            onDone={(next) => {
              onChange(next);
              setOpen(null);
            }}
          />
        )}
      </Sheet>
    </>
  );
}

interface DateTimePickerProps {
  readonly initial: string;
  readonly now: Date;
  readonly dayLocked: boolean;
  readonly onDone: (value: string) => void;
}

/** Mounted while the sheet is open, so the draft starts from the field's value each time. */
function DateTimePicker({ initial, now, dayLocked, onDone }: DateTimePickerProps) {
  const draft = useDateTimeDraft(initial);
  const cards = dayCards(now);
  const [calendar, setCalendar] = useState<{ year: number; month: number } | null>(() =>
    cards.some((card) => card.day === draft.day)
      ? null
      : { year: Number(draft.day.slice(0, 4)), month: Number(draft.day.slice(5, 7)) },
  );
  const today = localDay(now);
  const nowOnBoard = boardWallClock(now);
  const nowClock = `${String(nowOnBoard.hour).padStart(2, "0")}:${String(nowOnBoard.minute).padStart(2, "0")}`;
  const past = draft.day === today && draft.time.value < nowClock;
  const pastQuick = (clock: string) => draft.day === today && clock < nowClock;
  const lockedDay = splitInstant(initial).day;
  const cardClass =
    "flex min-h-[74px] w-[62px] shrink-0 flex-col items-center justify-center gap-1 rounded-button border-[1.5px] text-[12px] font-semibold tracking-[0.04em] uppercase disabled:opacity-[.32]";

  return (
    <>
      <div className="-mx-gutter flex shrink-0 gap-2 overflow-x-auto px-gutter py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {cards.map((card) => {
          const on = card.day === draft.day;
          return (
            <button
              key={card.day}
              type="button"
              aria-pressed={on}
              disabled={dayLocked && card.day !== lockedDay}
              onClick={() => {
                draft.setDay(card.day);
                setCalendar(null);
              }}
              className={`${cardClass} ${on ? "border-ink bg-ink text-bg" : "border-line-strong bg-surface text-ink-2"}`}
            >
              {card.weekday}
              <b
                className={`font-display text-[24px] leading-none font-bold tracking-[-0.02em] normal-case ${on ? "text-bg" : "text-ink"}`}
              >
                {card.number}
              </b>
            </button>
          );
        })}
        <button
          type="button"
          aria-pressed={calendar !== null}
          disabled={dayLocked}
          onClick={() => {
            setCalendar((current) =>
              current === null
                ? { year: Number(draft.day.slice(0, 4)), month: Number(draft.day.slice(5, 7)) }
                : null,
            );
          }}
          className={`${cardClass} border-dashed border-line-strong bg-surface text-brand-ink normal-case tracking-normal`}
        >
          <Icon name="cal" />
          Outro dia
        </button>
      </div>
      {dayLocked ? (
        <p className="text-secondary text-ink-2">
          Antes de sair, o horário só muda dentro do mesmo dia. Para outro dia, use Repetir.
        </p>
      ) : null}
      {calendar === null ? null : (
        <Calendar
          year={calendar.year}
          month={calendar.month}
          selected={draft.day}
          today={today}
          onMonth={setCalendar}
          onPick={draft.setDay}
        />
      )}
      <ClockPicker draft={draft.time} minuteStep={5} />
      {past ? (
        <p role="alert" className="flex items-start gap-1.5 text-sm font-semibold text-critical">
          <Icon name="alert" size={16} />
          Esse horário já passou: agora são {nowClock}. Escolha depois disso ou outro dia.
        </p>
      ) : null}
      <QuickTimes
        options={QUICK.map((clock) => ({ label: clock, value: clock }))}
        current={draft.time.value}
        onPick={draft.time.set}
        disabled={pastQuick}
      />
      <p className="text-secondary text-ink-2">
        Sai <b className="text-ink">{relativeDay(draft.day, now)}</b>, às{" "}
        <b className="text-ink">{draft.time.value}</b>.
      </p>
      <ActionButton
        emphasis="primary"
        disabled={past}
        onPress={() => {
          onDone(draft.value());
        }}
      >
        Pronto
      </ActionButton>
    </>
  );
}

interface CalendarProps {
  readonly year: number;
  readonly month: number;
  readonly selected: LocalDay;
  readonly today: LocalDay;
  readonly onMonth: (next: { year: number; month: number }) => void;
  readonly onPick: (day: LocalDay) => void;
}

/** A month in weeks; days gone are faded, today wears the brand ring (F7). */
function Calendar({ year, month, selected, today, onMonth, onPick }: CalendarProps) {
  const grid = monthGrid(year, month);
  const nav = "grid size-11 place-items-center rounded-full bg-surface-2 text-ink";
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <button
          type="button"
          aria-label="Mês anterior"
          onClick={() => {
            onMonth(shiftMonth(year, month, -1));
          }}
          className={nav}
        >
          <Icon name="back" />
        </button>
        <span className="font-display text-[20px] font-bold tracking-[-0.02em]">{grid.title}</span>
        <button
          type="button"
          aria-label="Próximo mês"
          onClick={() => {
            onMonth(shiftMonth(year, month, 1));
          }}
          className={nav}
        >
          <Icon name="chevron-right" />
        </button>
      </div>
      <div role="grid" aria-label={grid.title} className="grid grid-cols-7 gap-0.5 text-center">
        {["D", "S", "T", "Q", "Q", "S", "S"].map((letter, index) => (
          <span key={index} aria-hidden className="py-2 text-[12px] font-bold text-ink-3">
            {letter}
          </span>
        ))}
        {grid.weeks.flat().map((day, index) =>
          day === null ? (
            <span key={index} />
          ) : (
            <button
              key={day}
              type="button"
              aria-pressed={day === selected}
              disabled={day < today}
              onClick={() => {
                onPick(day);
              }}
              className={`h-11 rounded-[12px] text-base font-semibold tabular-nums disabled:opacity-[.45] ${
                day === selected
                  ? "bg-ink text-bg"
                  : day === today
                    ? "text-brand-ink inset-ring-[1.5px] inset-ring-brand"
                    : "text-ink"
              }`}
            >
              {Number(day.slice(8, 10))}
            </button>
          ),
        )}
      </div>
    </div>
  );
}
