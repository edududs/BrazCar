import type { HTMLInputAutoCompleteAttribute, HTMLInputTypeAttribute, ReactNode } from "react";

import { Box, FieldFrame, controlClass } from "./field";

interface TextFieldProps {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly type?: HTMLInputTypeAttribute;
  readonly autoComplete?: HTMLInputAutoCompleteAttribute;
  readonly inputMode?: "text" | "tel" | "email" | "numeric" | "decimal";
  readonly placeholder?: string;
  readonly required?: boolean;
  readonly readOnly?: boolean;
  readonly hint?: string | undefined;
  /** Why the value is refused; shown under the field and announced. */
  readonly error?: string | null;
  /** Before the text: a unit or a country code, "R$", "+55". */
  readonly prefix?: ReactNode;
  /** After the text: an icon, a button. */
  readonly suffix?: ReactNode;
  readonly optional?: boolean;
  readonly labelAside?: ReactNode;
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
  readOnly = false,
  hint,
  error = null,
  prefix,
  suffix,
  optional = false,
  labelAside,
  min,
  max,
  step,
}: TextFieldProps) {
  return (
    <FieldFrame label={label} hint={hint} error={error} optional={optional} labelAside={labelAside}>
      {(control) => (
        <Box prefix={prefix} suffix={suffix} invalid={error !== null} readOnly={readOnly}>
          <input
            {...control}
            type={type}
            value={value}
            onChange={(event) => {
              onChange(event.target.value);
            }}
            autoComplete={autoComplete}
            inputMode={inputMode}
            placeholder={placeholder}
            required={required}
            readOnly={readOnly}
            min={min}
            max={max}
            step={step}
            className={`${controlClass} h-[52px]`}
          />
        </Box>
      )}
    </FieldFrame>
  );
}
