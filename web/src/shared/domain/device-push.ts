/**
 * What the browser says about notifications on this device.
 *
 * `needs-install` is an iPhone in a Safari tab: there the notification API only exists once the
 * app is on the Home Screen, so it is a state of its own, distinct from `unsupported`.
 */
export type PushPermission = "unsupported" | "needs-install" | "default" | "granted" | "denied";

/** A device's Web Push subscription, as the browser's `toJSON()` gives it. */
export interface PushSubscriptionData {
  readonly endpoint: string;
  readonly keys: { readonly p256dh: string; readonly auth: string };
}

/** What a push call failed with, in words the screen can show; `status` is null off the wire. */
export class PushRequestError extends Error {
  constructor(
    readonly status: number | null,
    message: string,
  ) {
    super(message);
    this.name = "PushRequestError";
  }
}
