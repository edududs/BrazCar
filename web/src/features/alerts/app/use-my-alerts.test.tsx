// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as gateway from "../adapters/alerts-gateway";
import type { ActiveAlerts, RideAlert } from "../domain/alert";
import { alertKeys } from "./keys";
import { useMyAlerts } from "./use-my-alerts";

vi.mock("../adapters/alerts-gateway");

const mocked = vi.mocked(gateway);

const alert: RideAlert = {
  id: "a1",
  text: null,
  day: "2026-09-26",
  fromTime: "07:30",
  untilTime: null,
  createdAt: "2026-09-24T12:00:00-03:00",
};
const active: ActiveAlerts = { alerts: [alert], limit: 5 };

function renderAlerts(accountId: string | null) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, ...renderHook(() => useMyAlerts(accountId), { wrapper }) };
}

describe("useMyAlerts", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("starts loading with an empty list and no limit, then hands back the alerts", async () => {
    mocked.fetchAlerts.mockResolvedValue(active);
    const { result } = renderAlerts("acc");
    expect(result.current).toMatchObject({ status: "loading", alerts: [], limit: null });

    await waitFor(() => {
      expect(result.current.status).toBe("ready");
    });
    expect(result.current.alerts).toEqual([alert]);
    expect(result.current.limit).toBe(5);
  });

  it("is failed when the API refuses", async () => {
    mocked.fetchAlerts.mockRejectedValue(new Error("sem sessão"));
    const { result } = renderAlerts("acc");

    await waitFor(() => {
      expect(result.current.status).toBe("failed");
    });
    expect(result.current.alerts).toEqual([]);
  });

  it("asks for nothing without an account", () => {
    const { result } = renderAlerts(null);

    expect(mocked.fetchAlerts).not.toHaveBeenCalled();
    expect(result.current.status).toBe("loading");
  });

  it("removes one, names it while it goes, and refreshes the account's list", async () => {
    mocked.fetchAlerts.mockResolvedValue(active);
    let finish: () => void = () => undefined;
    mocked.deleteAlert.mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    const { result, client } = renderAlerts("acc");
    await waitFor(() => {
      expect(result.current.status).toBe("ready");
    });
    const invalidate = vi.spyOn(client, "invalidateQueries");
    mocked.fetchAlerts.mockResolvedValue({ alerts: [], limit: 5 });

    let removal: Promise<void> = Promise.resolve();
    act(() => {
      removal = result.current.remove("a1");
    });
    await waitFor(() => {
      expect(result.current.removing).toBe("a1");
    });
    await act(async () => {
      finish();
      await removal;
    });

    expect(mocked.deleteAlert.mock.calls[0]?.[0]).toBe("a1");
    expect(invalidate).toHaveBeenCalledWith({ queryKey: alertKeys.mine("acc") });
    await waitFor(() => {
      expect(result.current.alerts).toEqual([]);
    });
    expect(result.current.removing).toBeNull();
  });

  it("keeps each account's list under its own key", () => {
    expect(alertKeys.mine("a")).not.toEqual(alertKeys.mine("b"));
  });
});
