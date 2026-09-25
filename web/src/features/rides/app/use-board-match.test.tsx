// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as gateway from "@/features/places/adapters/places-gateway";
import type { Place } from "@/features/places/domain/place";

import type { Stop } from "../domain/ride";
import { searchKey, useBoardMatch } from "./use-board-match";

vi.mock("@/features/places/adapters/places-gateway");

const mocked = vi.mocked(gateway);

const SCS: Place = {
  id: "setor-comercial-sul",
  name: "Setor Comercial Sul",
  kind: "area",
  aliases: ["SCS"],
  parentId: "plano-piloto",
};

function renderMatch(text: string | null) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook((value: string | null) => useBoardMatch(value), {
    wrapper,
    initialProps: text,
  });
}

describe("searchKey", () => {
  it("drops accents, case and surrounding spaces", () => {
    expect(searchKey("  Plano Piloto  ")).toBe("plano piloto");
    expect(searchKey("Esplanada")).toBe(searchKey("ESPLANADA"));
  });
});

describe("useBoardMatch", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("matches nothing and asks nothing with no text", () => {
    const { result } = renderMatch(null);
    const stop: Stop = { placeId: "brazlandia", label: "Brazlândia", fare: null };
    expect(result.current.matches(stop)).toBe(false);
    expect(result.current.note).toBeNull();
    expect(mocked.searchPlaces).not.toHaveBeenCalled();
  });

  it("matches a stop by its catalog place id", async () => {
    mocked.searchPlaces.mockResolvedValue([SCS]);
    const { result } = renderMatch("scs");
    await waitFor(() => {
      expect(mocked.searchPlaces).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(
        result.current.matches({ placeId: "setor-comercial-sul", label: "SCS", fare: null }),
      ).toBe(true);
    });
  });

  it("matches free text stops by their own label", () => {
    const { result } = renderMatch("incra");
    expect(result.current.matches({ placeId: null, label: "Incra 8", fare: null })).toBe(true);
    expect(result.current.matches({ placeId: null, label: "Rodoviária", fare: null })).toBe(false);
  });

  it("explains an alias match with a note naming the real place", async () => {
    mocked.searchPlaces.mockResolvedValue([SCS]);
    const { result } = renderMatch("SCS");
    await waitFor(() => {
      expect(result.current.note).toBe(
        "Mostrando caronas que passam por Setor Comercial Sul (SCS).",
      );
    });
  });

  it("has no note when the text is not an alias, only a name or a plain word", async () => {
    mocked.searchPlaces.mockResolvedValue([{ ...SCS, aliases: [] }]);
    const { result } = renderMatch("Setor Comercial Sul");
    await waitFor(() => {
      expect(mocked.searchPlaces).toHaveBeenCalled();
    });
    expect(result.current.note).toBeNull();
  });
});
