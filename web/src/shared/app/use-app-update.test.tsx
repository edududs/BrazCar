// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as worker from "../adapters/service-worker";
import { useUnsavedWork } from "./unsaved-work";
import { useAppUpdate } from "./use-app-update";

// A factory, not an automock: the real module imports the plugin's virtual module, absent in tests.
vi.mock("../adapters/service-worker", () => ({
  applyUpdate: vi.fn(),
  readUpdateWaiting: vi.fn(),
  subscribeToUpdateWaiting: vi.fn(),
}));

const mocked = vi.mocked(worker);

describe("useAppUpdate", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocked.subscribeToUpdateWaiting.mockReturnValue(() => undefined);
    mocked.applyUpdate.mockResolvedValue();
  });
  afterEach(() => {
    cleanup(); // unmounts the forms, whose count is module state
  });

  it("offers nothing until a new build is waiting", () => {
    mocked.readUpdateWaiting.mockReturnValue(false);

    const { result } = renderHook(useAppUpdate);

    expect(result.current.available).toBe(false);
  });

  it("switches at once when nothing is being typed", () => {
    mocked.readUpdateWaiting.mockReturnValue(true);
    const { result } = renderHook(useAppUpdate);

    act(() => {
      result.current.request();
    });

    expect(mocked.applyUpdate).toHaveBeenCalledOnce();
  });

  it("asks first under an open form, and only switches on confirm (D-052)", () => {
    mocked.readUpdateWaiting.mockReturnValue(true);
    const { result } = renderHook(() => {
      useUnsavedWork();
      return useAppUpdate();
    });

    act(() => {
      result.current.request();
    });
    expect(result.current.confirming).toBe(true);
    expect(mocked.applyUpdate).not.toHaveBeenCalled();

    act(() => {
      result.current.cancel();
    });
    expect(result.current.confirming).toBe(false);
    expect(mocked.applyUpdate).not.toHaveBeenCalled();

    act(() => {
      result.current.request();
    });
    act(() => {
      result.current.confirm();
    });
    expect(mocked.applyUpdate).toHaveBeenCalledOnce();
  });

  it("forgets the form once it closes", () => {
    mocked.readUpdateWaiting.mockReturnValue(true);
    const form = renderHook(useUnsavedWork);
    form.unmount();
    const { result } = renderHook(useAppUpdate);

    act(() => {
      result.current.request();
    });

    expect(result.current.confirming).toBe(false);
    expect(mocked.applyUpdate).toHaveBeenCalledOnce();
  });
});
