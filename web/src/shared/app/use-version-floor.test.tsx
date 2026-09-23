// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as gateway from "../adapters/web-version-gateway";
import { useVersionFloor } from "./use-version-floor";

vi.mock("../adapters/web-version-gateway");
vi.mock("../adapters/service-worker", () => ({ applyUpdate: vi.fn() }));
vi.mock("../adapters/build-info", () => ({ appVersion: "0.7.0" }));

const mocked = vi.mocked(gateway);

function renderFloor() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(useVersionFloor, { wrapper });
}

describe("useVersionFloor", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("is checking until the API answers, and carries this build's version", () => {
    mocked.fetchMinimumWebVersion.mockReturnValue(new Promise(() => undefined));

    const { result } = renderFloor();

    expect(result.current.status).toBe("checking");
    expect(result.current.version).toBe("0.7.0");
  });

  it.each([
    ["0.7.0", "supported"],
    ["0.6.9", "supported"],
    ["0.7.1", "below-floor"],
    ["0.10.0", "below-floor"],
  ])("against a floor of %s the build is %s", async (minimum, status) => {
    mocked.fetchMinimumWebVersion.mockResolvedValue(minimum);

    const { result } = renderFloor();

    await waitFor(() => {
      expect(result.current.status).toBe(status);
    });
  });

  it("imposes no floor when the API does not say or does not answer", async () => {
    mocked.fetchMinimumWebVersion.mockResolvedValue(null);
    const silent = renderFloor();
    await waitFor(() => {
      expect(silent.result.current.status).toBe("supported");
    });

    mocked.fetchMinimumWebVersion.mockRejectedValue(new TypeError("Failed to fetch"));
    const down = renderFloor();
    await waitFor(() => {
      expect(down.result.current.status).toBe("supported");
    });
  });
});
