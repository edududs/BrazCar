// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as gateway from "../adapters/places-gateway";
import type { Place } from "../domain/place";
import { usePlace } from "./use-place";

vi.mock("../adapters/places-gateway");

const mocked = vi.mocked(gateway);

const BRAZLANDIA: Place = {
  id: "brazlandia",
  name: "Brazlândia",
  kind: "area",
  aliases: [],
  parentId: null,
};

function renderPlace(placeId: string | null) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook((id: string | null) => usePlace(id), { wrapper, initialProps: placeId });
}

describe("usePlace", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("is null without asking the API when there is no identifier", () => {
    const { result } = renderPlace(null);
    expect(result.current).toBeNull();
    expect(mocked.fetchPlace).not.toHaveBeenCalled();
  });

  it("resolves the place behind an identifier", async () => {
    mocked.fetchPlace.mockResolvedValue(BRAZLANDIA);
    const { result } = renderPlace("brazlandia");
    await waitFor(() => {
      expect(result.current).toEqual(BRAZLANDIA);
    });
  });

  it("stays null while unknown to the catalog", async () => {
    mocked.fetchPlace.mockResolvedValue(null);
    const { result } = renderPlace("nada");
    await waitFor(() => {
      expect(mocked.fetchPlace).toHaveBeenCalled();
    });
    expect(result.current).toBeNull();
  });
});
