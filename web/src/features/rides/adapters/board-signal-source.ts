import { apiBaseUrl } from "@/shared/adapters/api/base-url";
import { openResilientEventSource } from "@/shared/adapters/resilient-event-source";

/**
 * Keeps the connection alive through the tunnel and iOS (ADR-0013): a `ping` every 15s from the API.
 * Two missed pings plus margin. A network swap from the iPhone's Control Center kills the socket with
 * no event at all, and only this watchdog notices (D-107).
 */
const SILENCE_LIMIT_MS = 35_000;
const RESUME_GRACE_MS = 3000;

export interface BoardSignalSubscription {
  readonly close: () => void;
}

/**
 * The board's revision signal (ADR-0010): "changed, revision N", never the rides themselves.
 * `onRevision` fires for every number the API sends, including the first one on connect.
 */
export function subscribeToBoardSignal(
  onRevision: (revision: number) => void,
): BoardSignalSubscription {
  const source = openResilientEventSource({
    url: `${apiBaseUrl}/api/rides/signal`,
    withCredentials: false,
    events: ["revision", "ping"],
    silenceLimitMs: SILENCE_LIMIT_MS,
    resumeGraceMs: RESUME_GRACE_MS,
    onMessage: (message) => {
      if (message.event !== "revision") return;
      const parsed: unknown = JSON.parse(message.data);
      if (typeof parsed === "object" && parsed !== null && "revision" in parsed) {
        const { revision } = parsed;
        if (typeof revision === "number") onRevision(revision);
      }
    },
    onLifecycle: () => undefined,
  });
  return { close: source.close };
}
