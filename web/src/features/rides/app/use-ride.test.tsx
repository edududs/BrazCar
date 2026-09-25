// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as gateway from "../adapters/rides-gateway";
import { RideRequestError } from "../domain/ride";
import { openRide } from "./ride.fixture";
import { useRide } from "./use-ride";

vi.mock("../adapters/rides-gateway");

const mocked = vi.mocked(gateway);

function renderRide(rideId = "r1") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useRide(rideId), { wrapper });
}

describe("useRide", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("starts loading, then is ready with the ride", async () => {
    mocked.fetchRide.mockResolvedValue(openRide);
    const { result } = renderRide();
    expect(result.current.status).toBe("loading");
    await waitFor(() => {
      expect(result.current.status).toBe("ready");
    });
    expect(result.current.ride).toEqual(openRide);
  });

  it("is 'missing' on a 404, 'failed' on any other refusal", async () => {
    mocked.fetchRide.mockRejectedValue(new RideRequestError(404, "carona não encontrada"));
    const { result } = renderRide();
    await waitFor(() => {
      expect(result.current.status).toBe("missing");
    });

    mocked.fetchRide.mockRejectedValue(new RideRequestError(500, "erro"));
    const { result: other } = renderRide("r2");
    await waitFor(() => {
      expect(other.current.status).toBe("failed");
    });
  });

  it("changing seats remembers the ride the API hands back", async () => {
    mocked.fetchRide.mockResolvedValue(openRide);
    const changed = { ...openRide, seatsAvailable: 0, status: "full" as const };
    mocked.changeSeats.mockResolvedValue(changed);
    const { result } = renderRide();
    await waitFor(() => {
      expect(result.current.status).toBe("ready");
    });

    const handed = await act(() => result.current.changeSeats(0));

    expect(handed).toEqual(changed);
    expect(mocked.changeSeats).toHaveBeenCalledWith("r1", 0);
    await waitFor(() => {
      expect(result.current.ride).toEqual(changed);
    });
  });

  it("edit, cancel and repeat all call their gateway and settle busy back to false", async () => {
    mocked.fetchRide.mockResolvedValue(openRide);
    const edited = { ...openRide, price: "8.00" };
    const cancelled = { ...openRide, status: "cancelled" as const };
    const repeated = { ...openRide, id: "r9" };
    mocked.editRide.mockResolvedValue(edited);
    mocked.cancelRide.mockResolvedValue(cancelled);
    mocked.repeatRide.mockResolvedValue(repeated);
    const { result } = renderRide();
    await waitFor(() => {
      expect(result.current.status).toBe("ready");
    });

    await act(() => result.current.edit({ price: "8.00" }));
    expect(mocked.editRide).toHaveBeenCalledWith("r1", { price: "8.00" });

    await act(() => result.current.cancel());
    expect(mocked.cancelRide).toHaveBeenCalledWith("r1");

    await act(() => result.current.repeat("2026-09-24T07:00:00-03:00"));
    expect(mocked.repeatRide).toHaveBeenCalledWith("r1", "2026-09-24T07:00:00-03:00");

    expect(result.current.busy).toBe(false);
  });
});
