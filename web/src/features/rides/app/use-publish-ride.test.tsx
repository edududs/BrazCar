// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as gateway from "../adapters/rides-gateway";
import type { RideDraft } from "../domain/ride";
import { rideKeys } from "./keys";
import { openRide } from "./ride.fixture";
import { usePublishRide } from "./use-publish-ride";

vi.mock("../adapters/rides-gateway");

const mocked = vi.mocked(gateway);

const draft: RideDraft = {
  carId: "c1",
  stops: [
    { placeId: "brazlandia", text: "", fare: "" },
    { placeId: null, text: "Incra 8", fare: "" },
  ],
  departureAt: "2026-09-23T10:00:00.000Z",
  seatsAvailable: 3,
  price: "7.00",
  paymentMethods: ["pix"],
  notes: "",
};

describe("usePublishRide", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("publishes the draft, remembers the new ride and drops the cached boards", async () => {
    const mine = { ...openRide, isMine: true };
    mocked.publishRide.mockResolvedValue(mine);
    const client = new QueryClient();
    client.setQueryData(
      rideKeys.board({ day: null, text: null, withSeats: false, maxPrice: null }),
      [],
    );
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => usePublishRide(), { wrapper });

    const published = await act(() => result.current.publish(draft));

    expect(published).toEqual(mine);
    expect(mocked.publishRide).toHaveBeenCalledWith(draft);
    expect(client.getQueryData(rideKeys.one("r1"))).toEqual(mine);
    expect(client.getQueryState(rideKeys.boards)?.isInvalidated ?? true).toBe(true);
    expect(result.current.busy).toBe(false);
  });
});
