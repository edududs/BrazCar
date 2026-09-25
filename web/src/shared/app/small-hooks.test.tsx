// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { changePassword } from "@/features/accounts/adapters/accounts-gateway";
import { useChangePassword } from "@/features/accounts/app/use-change-password";
import { AccountRequestError } from "@/features/accounts/domain/account";

import { checkServiceHealth } from "../adapters/health-gateway";
import { useClock } from "./use-clock";
import { useServiceAvailability } from "./use-service-availability";

vi.mock("../adapters/health-gateway");
vi.mock("@/features/accounts/adapters/accounts-gateway");

/** One query client per test: the wrapper runs on every render and must not build a new one. */
function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("useClock", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-23T07:00:00-03:00"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("reads the time now and again every interval, not in between", () => {
    const { result } = renderHook(() => useClock(60_000));
    const start = result.current.getTime();

    act(() => {
      vi.advanceTimersByTime(59_999);
    });
    expect(result.current.getTime()).toBe(start);
    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(result.current.getTime()).toBe(start + 60_000);
  });

  it("stops ticking once the screen is gone", () => {
    const { unmount } = renderHook(() => useClock(1000));

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("useServiceAvailability", () => {
  it("is checking, then online when the API answers healthy", async () => {
    vi.mocked(checkServiceHealth).mockResolvedValue();

    const { result } = renderHook(() => useServiceAvailability(), { wrapper: makeWrapper() });

    expect(result.current).toBe("checking");
    await waitFor(() => {
      expect(result.current).toBe("online");
    });
  });

  it("is offline when the check fails", async () => {
    vi.mocked(checkServiceHealth).mockRejectedValue(new TypeError("Failed to fetch"));

    const { result } = renderHook(() => useServiceAvailability(), { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(result.current).toBe("offline");
    });
  });
});

describe("useChangePassword", () => {
  it("sends the passwords and is busy until the API answers", async () => {
    let finish: () => void = () => undefined;
    vi.mocked(changePassword).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const { result } = renderHook(() => useChangePassword(), { wrapper: makeWrapper() });

    let done: Promise<void> = Promise.resolve();
    act(() => {
      done = result.current.changePassword({ currentPassword: "a", newPassword: "b" });
    });
    await waitFor(() => {
      expect(result.current.busy).toBe(true);
    });
    act(() => {
      finish();
    });
    await done;

    expect(vi.mocked(changePassword).mock.calls[0]?.[0]).toEqual({
      currentPassword: "a",
      newPassword: "b",
    });
    await waitFor(() => {
      expect(result.current.busy).toBe(false);
    });
  });

  it("a refusal reaches the caller", async () => {
    vi.mocked(changePassword).mockRejectedValue(new AccountRequestError(400, "Senha errada."));
    const { result } = renderHook(() => useChangePassword(), { wrapper: makeWrapper() });

    await expect(
      act(() => result.current.changePassword({ currentPassword: "x", newPassword: "y" })),
    ).rejects.toMatchObject({ message: "Senha errada." });
  });
});
