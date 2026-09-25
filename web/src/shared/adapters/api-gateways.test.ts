import { beforeEach, describe, expect, it, vi } from "vitest";

import { checkServiceHealth } from "./health-gateway";
import { fetchMinimumWebVersion } from "./web-version-gateway";

const api = await vi.hoisted(async () => {
  const { installFakeApi } = await import("@/shared/testing/fake-api");
  return installFakeApi();
});

const signal = new AbortController().signal;

beforeEach(() => {
  api.reset();
});

describe("checkServiceHealth", () => {
  it("resolves when the API answers healthy", async () => {
    api.answer(200, { status: "ok" });

    await checkServiceHealth(signal);

    expect(api.last()).toMatchObject({ method: "GET", path: "/api/health" });
  });

  it("rejects on an error status", async () => {
    api.answerText(503, "down");

    await expect(checkServiceHealth(signal)).rejects.toThrow("status 503");
  });

  it("rejects with the network down", async () => {
    api.dropConnection();

    await expect(checkServiceHealth(signal)).rejects.toBeInstanceOf(TypeError);
  });
});

describe("fetchMinimumWebVersion", () => {
  it("reads the floor the API serves (D-105)", async () => {
    api.answer(200, { minimum: "0.20.0" });

    await expect(fetchMinimumWebVersion(signal)).resolves.toBe("0.20.0");
    expect(api.last().path).toBe("/api/web-version");
  });

  it("an API older than the floor route (404) is null", async () => {
    api.answer(404, { detail: "Not Found" });

    await expect(fetchMinimumWebVersion(signal)).resolves.toBeNull();
  });

  it("an error status is null too: a broken floor never blocks the app", async () => {
    api.answer(500, {});

    await expect(fetchMinimumWebVersion(signal)).resolves.toBeNull();
  });
});
