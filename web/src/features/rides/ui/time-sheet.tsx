import { useTimeDraft } from "@/shared/app/use-time-draft";
import { ActionButton } from "@/shared/ui/action-button";
import { ClockPicker, QuickTimes } from "@/shared/ui/clock-picker";
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
  const draft = useTimeDraft(initial, 15);
  return (
    <>
      <QuickTimes
        options={[
          { label: "Agora", value: now },
          ...QUICK.map((clock) => ({ label: clock, value: clock })),
        ]}
        current={draft.value}
        onPick={draft.set}
      />
      <ClockPicker draft={draft} minuteStep={15} />
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
