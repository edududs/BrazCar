import { Icon } from "./icon";

export interface ToggleOption<T extends string> {
  readonly value: T;
  readonly label: string;
}

interface ToggleFieldProps<T extends string> {
  readonly label: string;
  readonly options: readonly ToggleOption<T>[];
  readonly value: readonly T[];
  readonly onChange: (value: readonly T[]) => void;
}

/** Several choices that may all be on, as wide buttons with a check: payment methods (S07). */
export function ToggleField<T extends string>({
  label,
  options,
  value,
  onChange,
}: ToggleFieldProps<T>) {
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-2">
      <span className="text-secondary font-semibold text-ink">{label}</span>
      <div className="flex gap-2.5">
        {options.map((option) => {
          const on = value.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={on}
              onClick={() => {
                onChange(
                  on ? value.filter((each) => each !== option.value) : [...value, option.value],
                );
              }}
              className={`flex min-h-target flex-1 items-center justify-center gap-2 rounded-field border-[1.5px] text-body font-semibold ${
                on
                  ? "border-brand bg-brand-soft text-brand-ink"
                  : "border-line-strong bg-surface text-ink"
              }`}
            >
              {on ? <Icon name="check" size={16} /> : null}
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
