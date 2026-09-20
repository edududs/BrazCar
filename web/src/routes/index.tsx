import { createFileRoute } from "@tanstack/react-router";

import { useServiceAvailability } from "@/shared/app/use-service-availability";
import { AvailabilityBadge } from "@/shared/ui/availability-badge";
import { PageShell } from "@/shared/ui/page-shell";

export const Route = createFileRoute("/")({ component: StatusPage });

function StatusPage() {
  const availability = useServiceAvailability();
  return (
    <PageShell title="BrazCar">
      <AvailabilityBadge availability={availability} />
    </PageShell>
  );
}
