// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { searchPlaces } from "../adapters/places-gateway";
import type { Place } from "../domain/place";
import { usePlaceSearch } from "./use-place-search";

vi.mock("../adapters/places-gateway");

const esplanada: Place = {
  id: "esplanada",
  name: "Esplanada",
  kind: "area",
  aliases: [],
  parentId: "plano-piloto",
};
const brazlandia: Place = {
  id: "brazlandia",
  name: "Brazlândia",
  kind: "area",
  aliases: ["Braz"],
  parentId: null,
};

const gateway = vi.mocked(searchPlaces);

function renderSearch() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => usePlaceSearch({ typingPauseMs: 0 }), { wrapper });
}

describe("usePlaceSearch", () => {
  beforeEach(() => {
    gateway.mockReset();
  });

  it("lists the whole catalog before anything is typed", async () => {
    gateway.mockResolvedValue([brazlandia, esplanada]);

    const { result } = renderSearch();

    expect(result.current.status).toBe("loading");
    await waitFor(() => {
      expect(result.current.status).toBe("ready");
    });
    expect(result.current.places).toEqual([brazlandia, esplanada]);
    expect(gateway).toHaveBeenCalledWith("", expect.any(AbortSignal));
  });

  it("asks the API for what was typed, trimmed, and leaves matching to it", async () => {
    gateway.mockImplementation((query) =>
      Promise.resolve(query === "" ? [brazlandia, esplanada] : [brazlandia]),
    );
    const { result } = renderSearch();

    act(() => {
      result.current.setQuery(" braz ");
    });

    expect(result.current.query).toBe(" braz ");
    await waitFor(() => {
      expect(result.current.places).toEqual([brazlandia]);
    });
    expect(gateway).toHaveBeenLastCalledWith("braz", expect.any(AbortSignal));
  });

  it("keeps the previous matches on screen while the next search is in flight", async () => {
    let answer: (places: Place[]) => void = () => undefined;
    gateway.mockResolvedValueOnce([brazlandia, esplanada]).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          answer = resolve;
        }),
    );
    const { result } = renderSearch();
    await waitFor(() => {
      expect(result.current.status).toBe("ready");
    });

    act(() => {
      result.current.setQuery("espla");
    });
    await waitFor(() => {
      expect(gateway).toHaveBeenCalledTimes(2);
    });

    expect(result.current.places).toEqual([brazlandia, esplanada]);
    act(() => {
      answer([esplanada]);
    });
    await waitFor(() => {
      expect(result.current.places).toEqual([esplanada]);
    });
  });

  it("reports failure instead of pretending the catalog is empty", async () => {
    gateway.mockRejectedValue(new Error("offline"));

    const { result } = renderSearch();

    await waitFor(() => {
      expect(result.current.status).toBe("failed");
    });
  });
});
