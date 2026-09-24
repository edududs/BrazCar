interface TextAreaFieldProps {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly placeholder?: string;
  readonly rows?: number;
  /** With a limit, the field shows how much is left and stops accepting more. */
  readonly maxLength?: number;
  readonly hint?: string | undefined;
}

/** A multi-line text field. With `maxLength` it counts what is typed, right under the box. */
export function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
  maxLength,
  hint,
}: TextAreaFieldProps) {
  const counter = maxLength === undefined ? null : `${String(value.length)}/${String(maxLength)}`;
  return (
    <label className="flex flex-col gap-1 text-sm font-medium">
      {label}
      <textarea
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        placeholder={placeholder}
        rows={rows}
        maxLength={maxLength}
        className="rounded-lg border border-neutral-soft bg-surface p-3 text-base font-normal outline-none focus:border-accent"
      />
      {hint === undefined && counter === null ? null : (
        <span className="flex justify-between gap-2 text-xs font-normal opacity-70">
          <span>{hint}</span>
          {counter === null ? null : <span>{counter}</span>}
        </span>
      )}
    </label>
  );
}
