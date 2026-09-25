import type { ReactNode } from "react";

import { Box, FieldFrame, controlClass } from "./field";
import { Icon } from "./icon";

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
  /** Before the choice: an icon. */
  readonly prefix?: ReactNode;
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
  prefix,
}: SelectFieldProps) {
  return (
    <FieldFrame label={label} hint={hint}>
      {(control) => (
        <Box prefix={prefix} suffix={<Icon name="chevron-down" />}>
          <select
            {...control}
            value={value}
            onChange={(event) => {
              onChange(event.target.value);
            }}
            required={required}
            className={`${controlClass} h-[52px]`}
          >
            {placeholder === undefined ? null : <option value="">{placeholder}</option>}
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Box>
      )}
    </FieldFrame>
  );
}
