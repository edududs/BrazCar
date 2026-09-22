import { Badge, type BadgeTone } from "@/shared/ui/badge";

import type { RideStatus } from "../domain/ride";
import { statusLabel } from "./format";

const tones = {
  open: "positive",
  reopened: "positive",
  full: "neutral",
  departed: "neutral",
  cancelled: "critical",
} as const satisfies Record<RideStatus, BadgeTone>;

export function StatusBadge({ status }: { readonly status: RideStatus }) {
  return <Badge tone={tones[status]}>{statusLabel[status]}</Badge>;
}
