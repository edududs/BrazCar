import { useTimeDraft } from "@/shared/app/use-time-draft";
import { ActionButton } from "@/shared/ui/action-button";
import { Icon } from "@/shared/ui/icon";
import { Sheet } from "@/shared/ui/sheet";

interface TimeSheetProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** "HH:MM" already applied, or null. */
  readonly value: string | null;
  /** "HH:MM" for "Agora": the caller reads the clock. */
  readonly now: string;
  readonly onApply: (value: string | null) => void;
}

const QUICK = ["06:00", "07:00", "12:00", "17:00", "17:30", "18:00", "19:00"] as const;

/** "A partir de que horas?": quick times first, then the hour and the minutes by plus and minus (S15). */
export function TimeSheet({ open, onOpenChange, value, now, onApply }: TimeSheetProps) {
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="A partir de que horas?"
      description="Mostra só as caronas que saem nesse horário ou depois."
    >
      {open ? (
        <TimeSheetBody
          initial={value ?? now}
          now={now}
          onApply={(next) => {
            onApply(next);
            onOpenChange(false);
          }}
        />
      ) : null}
    </Sheet>
  );
}

interface TimeSheetBodyProps {
  readonly initial: string;
  readonly now: string;
  readonly onApply: (value: string | null) => void;
}

/** Mounted while the sheet is open, so the draft starts fresh from the applied value each time. */
function TimeSheetBody({ initial, now, onApply }: TimeSheetBodyProps) {
  const draft = useTimeDraft(initial);
  const quick = "min-h-[46px] rounded-[12px] border-[1.5px] text-base font-semibold tabular-nums";
  const on = "border-brand bg-brand-soft text-brand-ink";
  const off = "border-line bg-surface text-ink";
  const column = "grid h-11 w-[76px] place-items-center rounded-[12px] bg-surface-2 text-ink";
  return (
    <>
      <div className="grid grid-cols-4 gap-2">
        <button
          type="button"
          aria-pressed={draft.value === now}
          onClick={() => {
            draft.set(now);
          }}
          className={`${quick} ${draft.value === now ? on : off}`}
        >
          Agora
        </button>
        {QUICK.map((clock) => (
          <button
            key={clock}
            type="button"
            aria-pressed={draft.value === clock}
            onClick={() => {
              draft.set(clock);
            }}
            className={`${quick} ${draft.value === clock ? on : off}`}
          >
            {clock}
          </button>
        ))}
      </div>
      <div role="group" aria-label="Hora" className="flex items-center justify-center gap-2.5 py-1">
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
          <output
            aria-label="Hora"
            className="min-w-[92px] text-center font-display text-[60px] leading-none font-bold tracking-[-0.045em] tabular-nums"
          >
            {String(draft.hour).padStart(2, "0")}
          </output>
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
            aria-label="Quinze minutos a mais"
            onClick={() => {
              draft.addMinutes(1);
            }}
            className={column}
          >
            <Icon name="plus" />
          </button>
          <output
            aria-label="Minutos"
            className="min-w-[92px] text-center font-display text-[60px] leading-none font-bold tracking-[-0.045em] tabular-nums"
          >
            {String(draft.minute).padStart(2, "0")}
          </output>
          <button
            type="button"
            aria-label="Quinze minutos a menos"
            onClick={() => {
              draft.addMinutes(-1);
            }}
            className={column}
          >
            <Icon name="minus" />
          </button>
        </div>
      </div>
      <div className="flex gap-2.5">
        <div className="flex-1">
          <ActionButton
            emphasis="quiet"
            onPress={() => {
              onApply(null);
            }}
          >
            Limpar
          </ActionButton>
        </div>
        <div className="flex-[2]">
          <ActionButton
            emphasis="primary"
            onPress={() => {
              onApply(draft.value);
            }}
          >
            Mostrar caronas
          </ActionButton>
        </div>
      </div>
    </>
  );
}
