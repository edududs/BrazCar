/** Contracts of a server-to-browser signal connection (SSE today). Types only. */

export type ConnectionReadyState = "connecting" | "open" | "closed";

export type ConnectReason =
  | "start"
  | "manual"
  /** Nothing arrived for longer than the silence limit. */
  | "silence"
  /** The page came back, or the network changed, and nothing arrived within the grace period. */
  | "resume-grace-expired"
  /** The browser gave up on its own retries. */
  | "closed-by-error";

/** What woke the page up: a reason to doubt a connection that still claims to be open. */
export type ResumeTrigger = "visible" | "online" | "pageshow";

export type ConnectionLifecycleEvent =
  | { readonly kind: "connecting"; readonly reason: ConnectReason }
  | { readonly kind: "open" }
  | { readonly kind: "error"; readonly readyState: ConnectionReadyState }
  | {
      readonly kind: "environment";
      readonly change: ResumeTrigger | "hidden" | "offline" | "pagehide";
      readonly readyState: ConnectionReadyState;
      readonly silentForMs: number;
    }
  /** The connection proved itself alive after a resume, without a reconnect. */
  | { readonly kind: "survived"; readonly trigger: ResumeTrigger; readonly afterMs: number };

export interface SignalMessage {
  readonly event: string;
  readonly data: string;
}
