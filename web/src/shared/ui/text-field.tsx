import type { HTMLInputAutoCompleteAttribute, HTMLInputTypeAttribute } from "react";

interface TextFieldProps {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly type?: HTMLInputTypeAttribute;
  readonly autoComplete?: HTMLInputAutoCompleteAttribute;
  readonly inputMode?: "text" | "tel" | "email" | "numeric" | "decimal";
  readonly placeholder?: string;
  readonly required?: boolean;
  readonly hint?: string | undefined;
  /** Why the value is refused; shown under the field and announced. */
  readonly error?: string | null;
  /** For `number`, `date` and `datetime-local` inputs. */
  readonly min?: string | number;
  readonly max?: string | number;
  readonly step?: string | number;
}

export function TextField({
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
  inputMode,
  placeholder,
  required = false,
  hint,
  error = null,
  min,
  max,
  step,
}: TextFieldProps) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium">
      {label}
      <input
        type={type}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        autoComplete={autoComplete}
        inputMode={inputMode}
        placeholder={placeholder}
        required={required}
        aria-invalid={error === null ? undefined : true}
        min={min}
        max={max}
        step={step}
        className="min-h-11 rounded-lg border border-neutral-soft bg-surface px-3 text-base font-normal outline-none focus:border-accent"
      />
      {hint === undefined ? null : <span className="text-xs font-normal opacity-70">{hint}</span>}
      {error === null ? null : (
        <span role="alert" className="text-xs font-normal text-critical">
          {error}
        </span>
      )}
    </label>
  );
}
