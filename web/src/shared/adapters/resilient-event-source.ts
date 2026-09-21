import type {
  ConnectReason,
  ConnectionLifecycleEvent,
  ConnectionReadyState,
  ResumeTrigger,
  SignalMessage,
} from "../domain/signal-connection";

/**
 * EventSource with the three defences iOS needs (ADR-0010): a silence watchdog, a doubt-then-verify
 * step when the page resumes or the network changes, and a reconnect when the browser gives up.
 *
 * On resume the connection is not trusted: `readyState` can say "open" for a socket the system already
 * killed. If no event arrives within `resumeGraceMs`, a new connection replaces it.
 */
export interface ResilientEventSourceOptions {
  readonly url: string;
  readonly withCredentials: boolean;
  /** Named events to listen to. Comments (`: ping`) never reach JavaScript, so they cannot be here. */
  readonly events: readonly string[];
  /** Reconnect after this long without any listed event. Must exceed the server heartbeat. */
  readonly silenceLimitMs: number;
  /** How long a resumed connection has to prove itself alive. 0 reconnects at once. */
  readonly resumeGraceMs: number;
  readonly onMessage: (message: SignalMessage) => void;
  readonly onLifecycle: (event: ConnectionLifecycleEvent) => void;
}

export interface ResilientEventSource {
  readonly reconnect: () => void;
  readonly close: () => void;
}

const RETRY_AFTER_CLOSE_MS = 3000;

function readyStateOf(source: EventSource | null): ConnectionReadyState {
  switch (source?.readyState) {
    case EventSource.CONNECTING:
      return "connecting";
    case EventSource.OPEN:
      return "open";
    default:
      return "closed";
  }
}

export function openResilientEventSource(
  options: ResilientEventSourceOptions,
): ResilientEventSource {
  const { onLifecycle, onMessage, silenceLimitMs, resumeGraceMs } = options;
  let source: EventSource | null = null;
  let lastActivityAt = Date.now();
  let silenceTimer: number | undefined;
  let retryTimer: number | undefined;
  let pendingResume: { trigger: ResumeTrigger; since: number; timer: number } | null = null;

  const readyState = () => readyStateOf(source);

  const armSilenceTimer = () => {
    window.clearTimeout(silenceTimer);
    silenceTimer = window.setTimeout(() => {
      connect("silence");
    }, silenceLimitMs);
  };

  const settleResume = () => {
    if (pendingResume === null) return;
    window.clearTimeout(pendingResume.timer);
    const { trigger, since } = pendingResume;
    pendingResume = null;
    onLifecycle({ kind: "survived", trigger, afterMs: Date.now() - since });
  };

  const handleEvent = (event: MessageEvent<string>) => {
    lastActivityAt = Date.now();
    armSilenceTimer();
    settleResume();
    onMessage({ event: event.type, data: event.data });
  };

  function connect(reason: ConnectReason) {
    disconnect();
    onLifecycle({ kind: "connecting", reason });
    const next = new EventSource(options.url, { withCredentials: options.withCredentials });
    next.onopen = () => {
      onLifecycle({ kind: "open" });
    };
    next.onerror = () => {
      onLifecycle({ kind: "error", readyState: readyState() });
      // CONNECTING means the browser is retrying by itself; CLOSED means it gave up.
      if (next.readyState === EventSource.CLOSED) {
        window.clearTimeout(retryTimer);
        retryTimer = window.setTimeout(() => {
          connect("closed-by-error");
        }, RETRY_AFTER_CLOSE_MS);
      }
    };
    for (const name of options.events) {
      next.addEventListener(name, handleEvent);
    }
    source = next;
    armSilenceTimer();
  }

  function disconnect() {
    window.clearTimeout(silenceTimer);
    window.clearTimeout(retryTimer);
    if (pendingResume !== null) {
      window.clearTimeout(pendingResume.timer);
      pendingResume = null;
    }
    source?.close();
    source = null;
  }

  const report = (change: ResumeTrigger | "hidden" | "offline" | "pagehide") => {
    onLifecycle({
      kind: "environment",
      change,
      readyState: readyState(),
      silentForMs: Date.now() - lastActivityAt,
    });
  };

  const doubt = (trigger: ResumeTrigger) => {
    report(trigger);
    if (pendingResume !== null) return;
    if (resumeGraceMs === 0) {
      connect("resume-grace-expired");
      return;
    }
    const timer = window.setTimeout(() => {
      pendingResume = null;
      connect("resume-grace-expired");
    }, resumeGraceMs);
    pendingResume = { trigger, since: Date.now(), timer };
  };

  const onVisibility = () => {
    if (document.visibilityState === "visible") doubt("visible");
    else report("hidden");
  };
  const onOnline = () => {
    doubt("online");
  };
  const onOffline = () => {
    report("offline");
  };
  const onPageShow = () => {
    doubt("pageshow");
  };
  const onPageHide = () => {
    report("pagehide");
  };

  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("online", onOnline);
  window.addEventListener("offline", onOffline);
  window.addEventListener("pageshow", onPageShow);
  window.addEventListener("pagehide", onPageHide);
  connect("start");

  return {
    reconnect: () => {
      connect("manual");
    },
    close: () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("pagehide", onPageHide);
      disconnect();
    },
  };
}
