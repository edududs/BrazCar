import { afterEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "./api/client";
import { checkServiceHealth } from "./health-gateway";

vi.mock("./api/client", () => ({ apiClient: { GET: vi.fn() } }));

const get = vi.mocked(apiClient.GET);

afterEach(() => {
  vi.resetAllMocks();
});

describe("checkServiceHealth", () => {
  it("resolves when the API answers healthy", async () => {
    get.mockResolvedValue({ response: { ok: true } });
    const controller = new AbortController();
    await expect(checkServiceHealth(controller.signal)).resolves.toBeUndefined();
    expect(get).toHaveBeenCalledWith("/api/health", { signal: controller.signal });
  });

  it("rejects when the API answers with any error status", async () => {
    get.mockResolvedValue({ response: { ok: false, status: 503 } });
    await expect(checkServiceHealth(new AbortController().signal)).rejects.toThrow("503");
  });
});
