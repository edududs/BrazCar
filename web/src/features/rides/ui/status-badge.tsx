import { Badge, type BadgeTone } from "@/shared/ui/badge";
import { Icon, type IconName } from "@/shared/ui/icon";

import type { RideStatus } from "../domain/ride";
import { statusLabel } from "./format";

/** States tell apart by lightness, not hue alone: full is inverted, cancelled red, departed grey (F2). */
const looks = {
  open: { tone: "positive", icon: null },
  reopened: { tone: "positive", icon: "refresh" },
  full: { tone: "inverse", icon: null },
  departed: { tone: "neutral", icon: "clock" },
  cancelled: { tone: "critical", icon: "x" },
} as const satisfies Record<RideStatus, { tone: BadgeTone; icon: IconName | null }>;

export function StatusBadge({ status }: { readonly status: RideStatus }) {
  const { tone, icon } = looks[status];
  return (
    <Badge tone={tone} icon={icon === null ? undefined : <Icon name={icon} size={16} />}>
      {statusLabel[status]}
    </Badge>
  );
}
