// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as gateway from "../adapters/rides-gateway";
import { noFilters } from "../domain/board";
import { type Ride, RideRequestError } from "../domain/ride";
import { rideKeys } from "./keys";
import { openRide } from "./ride.fixture";
import { useMyRides } from "./use-my-rides";
import { useRide } from "./use-ride";

vi.mock("../adapters/rides-gateway");

const mocked = vi.mocked(gateway);

function clientAndWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

function renderRide(rideId = "r1") {
  const { client, wrapper } = clientAndWrapper();
  return { client, ...renderHook(() => useRide(rideId), { wrapper }) };
}

const mine: Ride = { ...openRide, isMine: true };

beforeEach(() => {
  vi.resetAllMocks();
});

describe("useRide", () => {
  it("is loading, then ready with the ride the API sent", async () => {
    mocked.fetchRide.mockResolvedValue(mine);

    const { result } = renderRide();

    expect(result.current.status).toBe("loading");
    expect(result.current.ride).toBeNull();
    await waitFor(() => {
      expect(result.current.status).toBe("ready");
    });
    expect(result.current.ride).toEqual(mine);
    expect(mocked.fetchRide).toHaveBeenCalledWith("r1", expect.any(AbortSignal));
  });

  it("a ride the API does not know (404) is missing, not a failure", async () => {
    mocked.fetchRide.mockRejectedValue(new RideRequestError(404, "Carona não encontrada."));

    const { result } = renderRide("gone");

    await waitFor(() => {
      expect(result.current.status).toBe("missing");
    });
  });

  it("any other refusal, or no network, is a failure", async () => {
    mocked.fetchRide.mockRejectedValueOnce(new RideRequestError(500, "boom"));
    const first = renderRide("a");
    await waitFor(() => {
      expect(first.result.current.status).toBe("failed");
    });

    mocked.fetchRide.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const second = renderRide("b");
    await waitFor(() => {
      expect(second.result.current.status).toBe("failed");
    });
  });

  it("a change of seats shows the API's answer at once and marks the board and my rides stale", async () => {
    mocked.fetchRide.mockResolvedValue(mine);
    const { result, client } = renderRide();
    await waitFor(() => {
      expect(result.current.status).toBe("ready");
    });
    client.setQueryData(rideKeys.board(noFilters), [mine]);
    client.setQueryData(rideKeys.mine, [mine]);
    const after = { ...mine, seatsAvailable: 1 };
    mocked.changeSeats.mockResolvedValue(after);

    const handed = await act(() => result.current.changeSeats(1));

    expect(handed).toEqual(after);
    expect(mocked.changeSeats).toHaveBeenCalledWith("r1", 1);
    await waitFor(() => {
      expect(result.current.ride?.seatsAvailable).toBe(1);
    });
    expect(client.getQueryState(rideKeys.board(noFilters))?.isInvalidated).toBe(true);
    expect(client.getQueryState(rideKeys.mine)?.isInvalidated).toBe(true);
  });

  it("edit and cancel go to the ride they were opened for", async () => {
    mocked.fetchRide.mockResolvedValue(mine);
    mocked.editRide.mockResolvedValue({ ...mine, price: "8.00" });
    mocked.cancelRide.mockResolvedValue({ ...mine, status: "cancelled" });
    const { result } = renderRide();
    await waitFor(() => {
      expect(result.current.status).toBe("ready");
    });

    await act(() => result.current.edit({ price: "8.00" }));
    expect(mocked.editRide).toHaveBeenCalledWith("r1", { price: "8.00" });
    await act(() => result.current.cancel());
    expect(mocked.cancelRide).toHaveBeenCalledWith("r1");

    await waitFor(() => {
      expect(result.current.ride?.status).toBe("cancelled");
    });
  });

  it("repeating remembers the new ride under its own id, leaving this one as it was", async () => {
    mocked.fetchRide.mockResolvedValue(mine);
    const copy = { ...mine, id: "r9", departureAt: "2026-09-24T07:00:00-03:00" };
    mocked.repeatRide.mockResolvedValue(copy);
    const { result, client } = renderRide();
    await waitFor(() => {
      expect(result.current.status).toBe("ready");
    });

    const repeated = await act(() => result.current.repeat(copy.departureAt));

    expect(repeated).toEqual(copy);
    expect(client.getQueryData(rideKeys.one("r9"))).toEqual(copy);
    expect(result.current.ride).toEqual(mine);
  });

  it("is busy while a change is on its way, and a refused change reaches the caller", async () => {
    mocked.fetchRide.mockResolvedValue(mine);
    let refuse: (error: Error) => void = () => undefined;
    mocked.cancelRide.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          refuse = reject;
        }),
    );
    const { result } = renderRide();
    await waitFor(() => {
      expect(result.current.status).toBe("ready");
    });

    let outcome: Promise<Ride> = Promise.resolve(mine);
    act(() => {
      outcome = result.current.cancel();
    });
    await waitFor(() => {
      expect(result.current.busy).toBe(true);
    });
    act(() => {
      refuse(new RideRequestError(409, "Já saiu."));
    });

    await expect(outcome).rejects.toMatchObject({ message: "Já saiu." });
    await waitFor(() => {
      expect(result.current.busy).toBe(false);
    });
  });
});

describe("useMyRides", () => {
  it("is loading, then ready with the driver's rides", async () => {
    mocked.fetchMyRides.mockResolvedValue([mine]);
    const { wrapper } = clientAndWrapper();

    const { result } = renderHook(() => useMyRides(), { wrapper });

    expect(result.current).toEqual({ rides: [], status: "loading" });
    await waitFor(() => {
      expect(result.current.status).toBe("ready");
    });
    expect(result.current.rides).toEqual([mine]);
  });

  it("without a session the list failed, and it does not keep retrying", async () => {
    mocked.fetchMyRides.mockRejectedValue(new RideRequestError(401, "Entre."));
    const { wrapper } = clientAndWrapper();

    const { result } = renderHook(() => useMyRides(), { wrapper });

    await waitFor(() => {
      expect(result.current.status).toBe("failed");
    });
    expect(mocked.fetchMyRides).toHaveBeenCalledTimes(1);
  });
});
