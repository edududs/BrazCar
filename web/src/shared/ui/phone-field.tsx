import type { PhoneFieldState } from "@/shared/app/use-phone-input";

import { TextField } from "./text-field";

interface PhoneFieldProps extends PhoneFieldState {
  readonly label?: string;
  readonly hint?: string;
  readonly required?: boolean;
}

/** A phone as people type it. Pair it with `usePhoneInput`: `<PhoneField {...phone.field} />`. */
export function PhoneField({
  label = "Telefone",
  value,
  onChange,
  error,
  hint,
  required = true,
}: PhoneFieldProps) {
  return (
    <TextField
      label={label}
      value={value}
      onChange={onChange}
      error={error}
      hint={hint}
      type="tel"
      inputMode="tel"
      autoComplete="tel"
      placeholder="(61) 99999-9999"
      required={required}
    />
  );
}
