// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as display from "../adapters/display-mode";
import * as flags from "../adapters/local-flags";
import { useInstallHint } from "./use-install-hint";

vi.mock("../adapters/display-mode");
vi.mock("../adapters/local-flags");

const mockedDisplay = vi.mocked(display);
const mockedFlags = vi.mocked(flags);

describe("useInstallHint", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedDisplay.installsByHand.mockReturnValue(true);
    mockedDisplay.detectDisplayMode.mockReturnValue("browser");
    mockedFlags.readFlag.mockReturnValue(false);
  });

  it("shows on an iPhone tab that never dismissed it", () => {
    expect(renderHook(useInstallHint).result.current.visible).toBe(true);
  });

  it.each([
    ["already installed", () => mockedDisplay.detectDisplayMode.mockReturnValue("standalone")],
    ["not an iPhone", () => mockedDisplay.installsByHand.mockReturnValue(false)],
    ["dismissed before", () => mockedFlags.readFlag.mockReturnValue(true)],
  ])("stays away when %s", (_case, arrange) => {
    arrange();

    expect(renderHook(useInstallHint).result.current.visible).toBe(false);
  });

  it("remembers the dismissal on this device", () => {
    const { result } = renderHook(useInstallHint);

    act(() => {
      result.current.dismiss();
    });

    expect(result.current.visible).toBe(false);
    expect(mockedFlags.writeFlag).toHaveBeenCalledWith("install-hint-dismissed");
  });
});
