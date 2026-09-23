/** Contracts of the installed app's shell: network, updates and version floor. Types only. */

export type NetworkStatus = "online" | "offline";

/** Where this build stands against the oldest front the API still serves (D-105). */
export type VersionFloorStatus = "checking" | "supported" | "below-floor";

/** How the browser shows the app: installed on the home screen, or a tab. */
export type DisplayMode = "standalone" | "browser";
