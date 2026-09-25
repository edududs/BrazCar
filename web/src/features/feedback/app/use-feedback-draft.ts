import { useState } from "react";

import { type PhoneFieldState, usePhoneInput } from "@/shared/app/use-phone-input";

import type { FeedbackData, FeedbackKind } from "../domain/feedback";

export const EMPTY_MESSAGE_ERROR = "Escreva sua opinião.";

export interface FeedbackDraft {
  readonly kind: FeedbackKind;
  readonly setKind: (kind: FeedbackKind) => void;
  readonly message: string;
  readonly setMessage: (message: string) => void;
  readonly messageError: string | null;
  /** Offered only in a complaint: whether it is about one person in particular. */
  readonly canNameSomeone: boolean;
  readonly aboutSomeone: boolean;
  readonly setAboutSomeone: (about: boolean) => void;
  /** The phone of that person, asked only once `aboutSomeone` is on. */
  readonly phone: PhoneFieldState;
  /** What to send, or `null` after marking what is missing. */
  readonly submitValue: () => FeedbackData | null;
}

/**
 * Headless: the opinion form (D-155). Three kinds; a complaint may name a person, by phone and
 * never by name, because the name on an account can change. Leaving the complaint drops the phone.
 */
export function useFeedbackDraft(): FeedbackDraft {
  const [kind, setKind] = useState<FeedbackKind>("suggestion");
  const [message, setMessageValue] = useState("");
  const [messageError, setMessageError] = useState<string | null>(null);
  const [aboutSomeone, setAboutSomeone] = useState(false);
  const phone = usePhoneInput();
  const canNameSomeone = kind === "complaint";

  const setMessage = (next: string) => {
    setMessageError(null);
    setMessageValue(next);
  };

  const submitValue = (): FeedbackData | null => {
    const trimmed = message.trim();
    setMessageError(trimmed === "" ? EMPTY_MESSAGE_ERROR : null);
    const naming = canNameSomeone && aboutSomeone;
    const aboutPhone = naming ? phone.submitValue() : null;
    if (trimmed === "" || (naming && aboutPhone === null)) return null;
    return { kind, message: trimmed, aboutPhone };
  };

  return {
    kind,
    setKind,
    message,
    setMessage,
    messageError,
    canNameSomeone,
    aboutSomeone: canNameSomeone && aboutSomeone,
    setAboutSomeone,
    phone: phone.field,
    submitValue,
  };
}
