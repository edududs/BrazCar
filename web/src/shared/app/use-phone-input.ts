import { useState } from "react";

import { formatAsTyped, toE164 } from "./phone-codec";

export const PHONE_HINT_ERROR = "Digite o celular com DDD, como (61) 99999-9999.";

/** What a phone field needs, ready to spread: `<PhoneField {...phone.field} />`. */
export interface PhoneFieldState {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly error: string | null;
}

export interface PhoneInput {
  readonly field: PhoneFieldState;
  /** E.164 to send, or `null` after showing why the number is not whole yet. */
  readonly submitValue: () => string | null;
}

/**
 * A phone typed the way people type it: formatted as the digits arrive, checked before it leaves.
 * Deleting never reformats, or the cursor would keep bumping into the parenthesis and the dash.
 */
export function usePhoneInput(initial = ""): PhoneInput {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  const onChange = (next: string) => {
    setError(null);
    setValue((current) => (next.length < current.length ? next : formatAsTyped(next)));
  };

  const submitValue = () => {
    const e164 = toE164(value);
    setError(e164 === null ? PHONE_HINT_ERROR : null);
    return e164;
  };

  return { field: { value, onChange, error }, submitValue };
}
