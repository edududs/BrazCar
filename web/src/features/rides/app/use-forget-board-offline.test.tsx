// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import * as gateway from "../adapters/rides-gateway";
import { noFilters } from "../domain/board";
import { rideKeys } from "./keys";
import { openRide } from "./ride.fixture";
import { useBoard } from "./use-board";
import { useForgetBoardOffline } from "./use-forget-board-offline";

vi.mock("../adapters/rides-gateway");

const mocked = vi.mocked(gateway);

function setNetwork(online: boolean) {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(online);
  window.dispatchEvent(new Event(online ? "online" : "offline"));
}

describe("useForgetBoardOffline", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("empties the mounted board while offline and loads it fresh when the network returns", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(rideKeys.one(openRide.id), openRide);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    mocked.fetchBoard.mockResolvedValue([openRide]);
    const { result } = renderHook(
      () => {
        useForgetBoardOffline();
        return useBoard(noFilters, { typingPauseMs: 0 });
      },
      { wrapper },
    );
    await waitFor(() => {
      expect(result.current.rides).toEqual([openRide]);
    });

    act(() => {
      setNetwork(false);
    });
    await waitFor(() => {
      expect(result.current.rides).toEqual([]);
    });
    expect(result.current.status).toBe("loading");
    expect(client.getQueryData(rideKeys.one(openRide.id))).toEqual(openRide);

    mocked.fetchBoard.mockResolvedValue([]);
    act(() => {
      setNetwork(true);
    });
    await waitFor(() => {
      expect(result.current.status).toBe("ready");
    });
    expect(result.current.rides).toEqual([]);
  });
});
