// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { searchPlaces } from "@/features/places/adapters/places-gateway";
import type { Place } from "@/features/places/domain/place";

import type { Stop } from "../domain/ride";
import { searchKey, useBoardMatch } from "./use-board-match";

vi.mock("@/features/places/adapters/places-gateway");

const gateway = vi.mocked(searchPlaces);

const scs: Place = {
  id: "scs",
  name: "Setor Comercial Sul",
  kind: "area",
  aliases: ["SCS", "Comercial Sul"],
  parentId: "plano-piloto",
};

const stopAt = (placeId: string | null, label: string): Stop => ({ placeId, label, fare: null });

function renderMatch(text: string | null) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useBoardMatch(text), { wrapper });
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("searchKey", () => {
  it("drops accents, case and surrounding blanks, as the API compares (D-101)", () => {
    expect(searchKey("  Brazlândia ")).toBe("brazlandia");
    expect(searchKey("ÁGUAS CLARAS")).toBe("aguas claras");
  });
});

describe("useBoardMatch", () => {
  it("without a search nothing is marked and the catalog is not asked", () => {
    const { result } = renderMatch(null);

    expect(result.current.matches(stopAt("scs", "Setor Comercial Sul"))).toBe(false);
    expect(result.current.note).toBeNull();
    expect(gateway).not.toHaveBeenCalled();
  });

  it("a blank search is no search", () => {
    const { result } = renderMatch("   ");

    expect(result.current.matches(stopAt(null, "Incra 8"))).toBe(false);
    expect(gateway).not.toHaveBeenCalled();
  });

  it("marks a free-text stop whose words contain the search, accents aside", () => {
    gateway.mockResolvedValue([]);

    const { result } = renderMatch("incra");

    expect(result.current.matches(stopAt(null, "Incra 8"))).toBe(true);
    expect(result.current.matches(stopAt(null, "Ceilândia"))).toBe(false);
  });

  it("marks a stop by the place behind an alias, and explains the alias once the catalog answers", async () => {
    gateway.mockResolvedValue([scs]);

    const { result } = renderMatch("SCS");

    await waitFor(() => {
      expect(result.current.note).toBe(
        "Mostrando caronas que passam por Setor Comercial Sul (SCS).",
      );
    });
    expect(gateway).toHaveBeenCalledWith("scs", expect.any(AbortSignal));
    expect(result.current.matches(stopAt("scs", "Setor Comercial Sul"))).toBe(true);
  });

  it("no note when the search is the place's own name", async () => {
    gateway.mockResolvedValue([scs]);

    const { result } = renderMatch("setor comercial sul");

    await waitFor(() => {
      expect(result.current.matches(stopAt("scs", "SCS Quadra 2"))).toBe(true);
    });
    expect(result.current.note).toBeNull();
  });
});
