import { describe, expect, it } from "vitest";

import { devicePushView } from "./device-push-view";

describe("devicePushView", () => {
  it.each([
    ["unsupported", false, "unsupported"],
    ["needs-install", false, "needs-install"],
    ["denied", false, "blocked"],
    ["default", false, "off"],
    ["granted", null, "checking"],
    ["granted", true, "on"],
    ["granted", false, "off"],
  ] as const)("reads %s with subscribed %s as %s", (permission, subscribed, expected) => {
    expect(devicePushView({ permission, subscribed })).toBe(expected);
  });
});
