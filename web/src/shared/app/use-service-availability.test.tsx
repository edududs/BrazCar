// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as gateway from "../adapters/health-gateway";
import { useServiceAvailability } from "./use-service-availability";

vi.mock("../adapters/health-gateway");

const mocked = vi.mocked(gateway);

function renderAvailability() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useServiceAvailability(), { wrapper });
}

describe("useServiceAvailability", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("starts checking, then is online once the health check resolves", async () => {
    mocked.checkServiceHealth.mockResolvedValue(undefined);
    const { result } = renderAvailability();
    expect(result.current).toBe("checking");
    await waitFor(() => {
      expect(result.current).toBe("online");
    });
  });

  it("is offline once the health check rejects", async () => {
    mocked.checkServiceHealth.mockRejectedValue(new Error("network"));
    const { result } = renderAvailability();
    await waitFor(() => {
      expect(result.current).toBe("offline");
    });
  });
});
