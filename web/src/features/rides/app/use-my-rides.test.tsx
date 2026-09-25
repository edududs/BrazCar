// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as gateway from "../adapters/rides-gateway";
import { openRide } from "./ride.fixture";
import { useMyRides } from "./use-my-rides";

vi.mock("../adapters/rides-gateway");

const mocked = vi.mocked(gateway);

function renderMyRides() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useMyRides(), { wrapper });
}

describe("useMyRides", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("starts loading with an empty list, then hands back the driver's own rides", () => {
    mocked.fetchMyRides.mockResolvedValue([openRide]);
    const { result } = renderMyRides();
    expect(result.current.status).toBe("loading");
    expect(result.current.rides).toEqual([]);
  });

  it("is ready with every ride once the API answers", async () => {
    mocked.fetchMyRides.mockResolvedValue([openRide]);
    const { result } = renderMyRides();
    await waitFor(() => {
      expect(result.current.status).toBe("ready");
    });
    expect(result.current.rides).toEqual([openRide]);
  });

  it("is failed, with an empty list, when the API refuses", async () => {
    mocked.fetchMyRides.mockRejectedValue(new Error("sem sessão"));
    const { result } = renderMyRides();
    await waitFor(() => {
      expect(result.current.status).toBe("failed");
    });
    expect(result.current.rides).toEqual([]);
  });
});
