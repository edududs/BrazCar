import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import type { Place } from "@/features/places/domain/place";
import { PlacePicker } from "@/features/places/ui/place-picker";
import { useServiceAvailability } from "@/shared/app/use-service-availability";
import { AvailabilityBadge } from "@/shared/ui/availability-badge";
import { PageShell } from "@/shared/ui/page-shell";

export const Route = createFileRoute("/")({ component: StatusPage });

function StatusPage() {
  const availability = useServiceAvailability();
  const [place, setPlace] = useState<Place | null>(null);
  return (
    <PageShell title="BrazCar">
      <AvailabilityBadge availability={availability} />
      <PlacePicker label="Lugar" value={place} onChange={setPlace} />
      {place === null ? null : <p className="text-sm">Escolhido: {place.name}</p>}
    </PageShell>
  );
}
