import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@base-ui/react/radio-group";
import type { ReactNode } from "react";

export interface SegmentedOption<T extends string> {
  readonly value: T;
  readonly label: string;
  readonly icon?: ReactNode;
}

interface SegmentedProps<T extends string> {
  /** What the group chooses, for assistive technology. */
  readonly label: string;
  readonly options: readonly SegmentedOption<T>[];
  readonly value: T;
  readonly onChange: (value: T) => void;
}

/** One choice among a few, all visible: a radio group drawn as a rail, over Base UI (D-088). */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: SegmentedProps<T>) {
  return (
    <RadioGroup
      aria-label={label}
      value={value}
      onValueChange={(next) => {
        const chosen = options.find((option) => option.value === next);
        if (chosen !== undefined) onChange(chosen.value);
      }}
      className="grid auto-cols-fr grid-flow-col gap-1 rounded-field bg-surface-2 p-1"
    >
      {options.map((option) => (
        <Radio.Root
          key={option.value}
          value={option.value}
          className="flex min-h-11 items-center justify-center gap-1.5 rounded-[11px] text-secondary font-semibold text-ink-2 data-checked:bg-surface data-checked:text-ink data-checked:shadow-1 data-checked:inset-ring data-checked:inset-ring-line-soft"
        >
          {option.icon}
          {option.label}
        </Radio.Root>
      ))}
    </RadioGroup>
  );
}
