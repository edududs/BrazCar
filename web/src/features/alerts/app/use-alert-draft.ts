import { useState } from "react";

import { type DayCard, boardWallClock, dayCards, localDay } from "@/shared/app/calendar";
import {
  type Clock,
  type TimeDraft,
  formatClock,
  parseClock,
  useTimeDraft,
} from "@/shared/app/use-time-draft";

import type { AlertData } from "../domain/alert";

const MINUTE_STEP = 15;
const LAST_START = 23 * 60 + 45;

/** What the board is showing now: the sheet starts from it. */
export interface AlertSeed {
  readonly day: string | null;
  readonly text: string | null;
  readonly fromTime: string | null;
}

/** One end of the window: on or off, and the clock it would take. */
export interface ClockSlot {
  readonly on: boolean;
  readonly setOn: (on: boolean) => void;
  readonly time: TimeDraft;
}

export interface AlertDraft {
  readonly dayOptions: readonly DayCard[];
  readonly day: string;
  readonly setDay: (day: string) => void;
  readonly text: string;
  readonly setText: (text: string) => void;
  readonly from: ClockSlot;
  readonly until: ClockSlot;
  /** What to send. The rules (day, window, ceiling) are the API's. */
  readonly value: () => AlertData;
}

/** An hour after `from`, held to the last quarter of the day. */
function hourAfter(from: string): Clock {
  const parsed = parseClock(from) ?? { hour: 0, minute: 0 };
  const total = Math.min(parsed.hour * 60 + parsed.minute + 60, LAST_START);
  return formatClock(Math.floor(total / 60), total % 60);
}

/** Headless: the alert sheet's fields, seeded from the board's filter, on the board's clock. */
export function useAlertDraft({ seed, now }: { seed: AlertSeed; now: Date }): AlertDraft {
  const [dayOptions] = useState(() => dayCards(now));
  const [day, setDay] = useState(
    () => dayOptions.find((option) => option.day === seed.day)?.day ?? localDay(now),
  );
  const [text, setText] = useState(seed.text ?? "");
  const [startClock] = useState<string>(() => {
    if (seed.fromTime !== null) return seed.fromTime;
    const { hour, minute } = boardWallClock(now);
    return formatClock(hour, minute);
  });
  const [fromOn, setFromOn] = useState(seed.fromTime !== null);
  const [untilOn, setUntilOn] = useState(false);
  const fromTime = useTimeDraft(startClock, MINUTE_STEP);
  const untilTime = useTimeDraft(hourAfter(startClock), MINUTE_STEP);

  return {
    dayOptions,
    day,
    setDay,
    text,
    setText,
    from: { on: fromOn, setOn: setFromOn, time: fromTime },
    until: { on: untilOn, setOn: setUntilOn, time: untilTime },
    value: () => ({
      day,
      text: text.trim() === "" ? null : text.trim(),
      fromTime: fromOn ? fromTime.value : null,
      untilTime: untilOn ? untilTime.value : null,
    }),
  };
}
