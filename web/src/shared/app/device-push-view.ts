import type { PushPermission } from "../domain/device-push";

/** What a screen shows about notifications on this device: one word per situation. */
export type DevicePushView =
  "unsupported" | "needs-install" | "blocked" | "checking" | "on" | "off";

interface DevicePushState {
  readonly permission: PushPermission;
  readonly subscribed: boolean | null;
}

/** Folds the permission and the subscription into the one situation a screen draws. */
export function devicePushView({ permission, subscribed }: DevicePushState): DevicePushView {
  switch (permission) {
    case "unsupported":
    case "needs-install":
      return permission;
    case "denied":
      return "blocked";
    case "default":
      return "off";
    case "granted":
      if (subscribed === null) return "checking";
      return subscribed ? "on" : "off";
  }
}
