export interface SelectOption {
  readonly value: string;
  readonly label: string;
}

interface SelectFieldProps {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly options: readonly SelectOption[];
  /** Shown as the first, empty choice; without it the first option is preselected by the browser. */
  readonly placeholder?: string;
  readonly required?: boolean;
  readonly hint?: string;
}

/** One choice among a few: the native control, which every phone renders as a picker. */
export function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
  required = false,
  hint,
}: SelectFieldProps) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium">
      {label}
      <select
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        required={required}
        className="min-h-11 rounded-lg border border-neutral-soft bg-surface px-3 text-base font-normal outline-none focus:border-accent"
      >
        {placeholder === undefined ? null : <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hint === undefined ? null : <span className="text-xs font-normal opacity-70">{hint}</span>}
    </label>
  );
}
