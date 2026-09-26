import { useState } from "react";

import { type PhoneFieldState, usePhoneInput } from "@/shared/app/use-phone-input";

import { requestRemoval } from "../adapters/removal-gateway";
import { RemovalRequestError } from "../domain/removal-request";

export type RemovalRequestState = "idle" | "busy" | "sent";

export interface RemovalRequestForm {
  readonly phone: PhoneFieldState;
  readonly note: string;
  readonly setNote: (note: string) => void;
  readonly state: RemovalRequestState;
  /** Why the last attempt was refused; `null` once typing starts again. */
  readonly error: string | null;
  readonly submit: () => void;
}

/**
 * Headless: the public removal request (D-172). One phone, one optional note, sent once; the only
 * outcome is "received", since the request is only ever decided later, by command, and nobody is
 * told when that happens.
 */
export function useRemovalRequest(): RemovalRequestForm {
  const phone = usePhoneInput();
  const [note, setNoteValue] = useState("");
  const [state, setState] = useState<RemovalRequestState>("idle");
  const [error, setError] = useState<string | null>(null);

  const setNote = (next: string) => {
    setError(null);
    setNoteValue(next);
  };

  const submit = () => {
    setError(null);
    const e164 = phone.submitValue();
    if (e164 === null) return;
    setState("busy");
    const trimmed = note.trim();
    requestRemoval({ phone: e164, note: trimmed === "" ? null : trimmed }).then(
      () => {
        setState("sent");
      },
      (reason: unknown) => {
        setState("idle");
        setError(
          reason instanceof RemovalRequestError
            ? reason.message
            : "Não foi possível enviar. Tente de novo.",
        );
      },
    );
  };

  return { phone: phone.field, note, setNote, state, error, submit };
}
