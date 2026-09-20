import type { ServiceAvailability } from "../domain/service-availability";

const appearance = {
  checking: { label: "Verificando o serviço…", tone: "bg-neutral-soft text-content" },
  online: { label: "Serviço no ar", tone: "bg-positive-soft text-positive" },
  offline: { label: "Serviço fora do ar", tone: "bg-critical-soft text-critical" },
} as const satisfies Record<ServiceAvailability, { label: string; tone: string }>;

interface AvailabilityBadgeProps {
  readonly availability: ServiceAvailability;
}

export function AvailabilityBadge({ availability }: AvailabilityBadgeProps) {
  const { label, tone } = appearance[availability];
  return (
    <p role="status" className={`w-fit rounded-full px-3 py-1 text-sm font-medium ${tone}`}>
      {label}
    </p>
  );
}
