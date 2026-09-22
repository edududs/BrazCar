import { useMutation } from "@tanstack/react-query";

import { requestContact } from "../adapters/rides-gateway";
import type { Contact } from "../domain/ride";

export interface Contacting {
  /** What the API handed out, once asked. Held here so the screen can show the plate after opening WhatsApp. */
  readonly contact: Contact | null;
  readonly request: () => Promise<Contact>;
  readonly busy: boolean;
}

/** Headless contact request (ADR-0006): one call, one record on the API, one link back. */
export function useContact(rideId: string): Contacting {
  const mutation = useMutation({ mutationFn: () => requestContact(rideId) });
  return {
    contact: mutation.data ?? null,
    request: () => mutation.mutateAsync(),
    busy: mutation.isPending,
  };
}
