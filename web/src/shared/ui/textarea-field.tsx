import { Box, FieldFrame, controlClass } from "./field";

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
  const counter =
    maxLength === undefined ? undefined : `${String(value.length)}/${String(maxLength)}`;
  return (
    <FieldFrame label={label} hint={hint} aside={counter}>
      {(control) => (
        <Box multiline>
          <textarea
            {...control}
            value={value}
            onChange={(event) => {
              onChange(event.target.value);
            }}
            placeholder={placeholder}
            rows={rows}
            maxLength={maxLength}
            className={`${controlClass} resize-none leading-[1.45]`}
          />
        </Box>
      )}
    </FieldFrame>
  );
}
