// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as gateway from "../adapters/rides-gateway";
import { type BoardFilters, noFilters } from "../domain/board";
import type { Ride } from "../domain/ride";
import { openRide } from "./ride.fixture";
import { useBoard } from "./use-board";

vi.mock("../adapters/rides-gateway");

const mocked = vi.mocked(gateway);

function renderBoard(initial: BoardFilters) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook((filters: BoardFilters) => useBoard(filters, { typingPauseMs: 0 }), {
    wrapper,
    initialProps: initial,
  });
}

describe("useBoard", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("asks the API with the filters and hands the rides back", async () => {
    mocked.fetchBoard.mockResolvedValue([openRide]);
    const filters: BoardFilters = { ...noFilters, text: "incra", withSeats: true };

    const { result } = renderBoard(filters);

    expect(result.current.status).toBe("loading");
    await waitFor(() => {
      expect(result.current.status).toBe("ready");
    });
    expect(result.current.rides).toEqual([openRide]);
    expect(mocked.fetchBoard).toHaveBeenCalledWith(filters, expect.any(AbortSignal));
  });

  it("keeps the last list while a new filter loads, then fetches again on refresh", async () => {
    mocked.fetchBoard.mockResolvedValue([openRide]);
    const { result, rerender } = renderBoard(noFilters);
    await waitFor(() => {
      expect(result.current.status).toBe("ready");
    });

    mocked.fetchBoard.mockResolvedValue([]);
    rerender({ ...noFilters, day: "2026-09-23" });

    expect(result.current.rides).toEqual([openRide]);
    await waitFor(() => {
      expect(result.current.rides).toEqual([]);
    });

    mocked.fetchBoard.mockResolvedValue([openRide]);
    act(() => {
      result.current.refresh();
    });
    await waitFor(() => {
      expect(result.current.rides).toEqual([openRide]);
    });
    expect(mocked.fetchBoard).toHaveBeenCalledTimes(3);
  });

  it("drops a fetch in flight on refresh, so a newer revision is never answered by an older list", async () => {
    mocked.fetchBoard.mockResolvedValueOnce([]);
    const { result } = renderBoard(noFilters);
    await waitFor(() => {
      expect(result.current.status).toBe("ready");
    });

    let finishStale: (rides: Ride[]) => void = () => undefined;
    mocked.fetchBoard.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishStale = resolve;
        }),
    );
    act(() => {
      result.current.refresh(); // the fetch for revision N starts
    });
    mocked.fetchBoard.mockResolvedValueOnce([openRide]);
    act(() => {
      result.current.refresh(); // revision N+1 arrives while it is in flight
    });
    finishStale([]);

    await waitFor(() => {
      expect(result.current.rides).toEqual([openRide]);
    });
    expect(mocked.fetchBoard).toHaveBeenCalledTimes(3);
  });

  it("reports a failure without pretending the board is empty for good", async () => {
    mocked.fetchBoard.mockRejectedValue(new Error("down"));

    const { result } = renderBoard(noFilters);

    await waitFor(() => {
      expect(result.current.status).toBe("failed");
    });
    expect(result.current.rides).toEqual([]);
  });
});
