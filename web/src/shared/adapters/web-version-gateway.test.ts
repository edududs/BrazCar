import { afterEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "./api/client";
import { fetchMinimumWebVersion } from "./web-version-gateway";

vi.mock("./api/client", () => ({ apiClient: { GET: vi.fn() } }));

const get = vi.mocked(apiClient.GET);

afterEach(() => {
  vi.resetAllMocks();
});

describe("fetchMinimumWebVersion", () => {
  it("returns the floor the API declares", async () => {
    get.mockResolvedValue({ data: { minimum: "1.2.0" } });
    const controller = new AbortController();
    await expect(fetchMinimumWebVersion(controller.signal)).resolves.toBe("1.2.0");
    expect(get).toHaveBeenCalledWith("/api/web-version", { signal: controller.signal });
  });

  it("is null when the API says nothing, never throws (D-105: a floor is an emergency brake, not a lock)", async () => {
    get.mockResolvedValue({ data: undefined });
    await expect(fetchMinimumWebVersion(new AbortController().signal)).resolves.toBeNull();
  });
});
