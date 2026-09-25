import { Icon } from "./icon";

interface StepperProps {
  readonly value: number;
  readonly onChange: (value: number) => void;
  readonly min: number;
  readonly max: number;
  readonly disabled?: boolean;
  /** What the number is, for assistive technology: "Vagas". */
  readonly label: string;
  readonly decreaseLabel: string;
  readonly increaseLabel: string;
}

/** A number with a minus and a plus, each a 54 px target, the number in display type (F4). */
export function Stepper({
  value,
  onChange,
  min,
  max,
  disabled = false,
  label,
  decreaseLabel,
  increaseLabel,
}: StepperProps) {
  const button =
    "grid size-target place-items-center rounded-field bg-surface text-ink shadow-1 inset-ring inset-ring-line-soft disabled:opacity-40";
  return (
    <div
      role="group"
      aria-label={label}
      className="flex w-fit items-center rounded-[18px] bg-surface-2 p-1"
    >
      <button
        type="button"
        aria-label={decreaseLabel}
        disabled={disabled || value <= min}
        onClick={() => {
          onChange(value - 1);
        }}
        className={button}
      >
        <Icon name="minus" />
      </button>
      <output
        aria-label={label}
        className="min-w-[70px] text-center font-display text-time font-bold tabular-nums"
      >
        <span key={value} className="inline-block animate-bump">
          {value}
        </span>
      </output>
      <button
        type="button"
        aria-label={increaseLabel}
        disabled={disabled || value >= max}
        onClick={() => {
          onChange(value + 1);
        }}
        className={button}
      >
        <Icon name="plus" />
      </button>
    </div>
  );
}
