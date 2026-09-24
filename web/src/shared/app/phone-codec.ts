/**
 * The one door to `libphonenumber-js` (D-136), in its `min` metadata: enough to format while the
 * person types and to tell a whole number from a half-typed one. Which numbers may own an account
 * (a Brazilian mobile, D-137) is the API's rule; it answers with the reason when it refuses.
 */
import { AsYouType, parsePhoneNumberFromString } from "libphonenumber-js/min";

/** Numbers typed without a country are read as Brazilian: it is where the platform runs. */
const TYPING_COUNTRY = "BR";

/** `"61999990001"` becomes `"(61) 99999-0001"` as the digits arrive. */
export function formatAsTyped(raw: string): string {
  return new AsYouType(TYPING_COUNTRY).input(raw);
}

/** `"+5561999990001"` for a whole number; `null` for anything the numbering plan would not take. */
export function toE164(raw: string): string | null {
  const number = parsePhoneNumberFromString(raw, TYPING_COUNTRY);
  return number?.isValid() === true ? number.number : null;
}
