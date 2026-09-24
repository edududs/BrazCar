import { useState } from "react";

import { ActionButton } from "@/shared/ui/action-button";

import { useContact } from "../app/use-contact";
import { reasonOf } from "./reason";

interface ContactButtonProps {
  readonly rideId: string;
}

/**
 * The only door to the phone and the plate (ADR-0006). One tap asks the API; what comes back is a
 * link the person opens themselves, so no popup blocker gets in the way.
 */
export function ContactButton({ rideId }: ContactButtonProps) {
  const { contact, request, busy } = useContact(rideId);
  const [error, setError] = useState<string | null>(null);

  if (contact !== null) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm">
          {contact.plate === null ? (
            "Sem placa cadastrada: confirme o carro com o motorista. Combine pelo WhatsApp:"
          ) : (
            <>
              Placa <strong>{contact.plate}</strong>. Combine pelo WhatsApp:
            </>
          )}
        </p>
        <a
          href={contact.whatsappUrl}
          target="_blank"
          rel="noreferrer"
          className="flex min-h-11 items-center justify-center rounded-lg bg-positive px-4 text-sm font-medium text-surface"
        >
          Falar no WhatsApp
        </a>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <ActionButton
        emphasis="primary"
        disabled={busy}
        onPress={() => {
          setError(null);
          request().catch((reason: unknown) => {
            setError(reasonOf(reason));
          });
        }}
      >
        Pedir contato
      </ActionButton>
      {error === null ? null : (
        <p role="alert" className="text-sm text-critical">
          {error}
        </p>
      )}
    </div>
  );
}
