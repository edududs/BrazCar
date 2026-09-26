// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as gateway from "../adapters/removal-gateway";
import { RemovalRequestError } from "../domain/removal-request";
import { useRemovalRequest } from "./use-removal-request";

vi.mock("../adapters/removal-gateway");

const mocked = vi.mocked(gateway);

describe("useRemovalRequest", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("starts idle, with no note", () => {
    const { result } = renderHook(() => useRemovalRequest());

    expect(result.current.state).toBe("idle");
    expect(result.current.note).toBe("");
    expect(result.current.error).toBeNull();
  });

  it("an unfinished phone is marked, and nothing is sent", () => {
    const { result } = renderHook(() => useRemovalRequest());

    act(() => {
      result.current.phone.onChange("6199");
    });
    act(() => {
      result.current.submit();
    });

    expect(result.current.phone.error).toBe("Digite o celular com DDD, como (61) 99999-9999.");
    expect(mocked.requestRemoval).not.toHaveBeenCalled();
    expect(result.current.state).toBe("idle");
  });

  it("sends the whole phone with the trimmed note, and settles on 'sent'", async () => {
    mocked.requestRemoval.mockResolvedValue();
    const { result } = renderHook(() => useRemovalRequest());

    act(() => {
      result.current.phone.onChange("61999990002");
    });
    act(() => {
      result.current.setNote("  Não anuncio mais nesse número.  ");
    });
    act(() => {
      result.current.submit();
    });

    expect(result.current.state).toBe("busy");
    await waitFor(() => {
      expect(result.current.state).toBe("sent");
    });
    expect(mocked.requestRemoval).toHaveBeenCalledWith({
      phone: "+5561999990002",
      note: "Não anuncio mais nesse número.",
    });
  });

  it("a blank note is sent as null", async () => {
    mocked.requestRemoval.mockResolvedValue();
    const { result } = renderHook(() => useRemovalRequest());

    act(() => {
      result.current.phone.onChange("61999990002");
    });
    act(() => {
      result.current.submit();
    });

    await waitFor(() => {
      expect(mocked.requestRemoval).toHaveBeenCalledWith({
        phone: "+5561999990002",
        note: null,
      });
    });
  });

  it("what the API refuses is kept as the reason, and the form goes back to idle", async () => {
    mocked.requestRemoval.mockRejectedValue(
      new RemovalRequestError(429, "Muitos pedidos hoje. Tente de novo amanhã."),
    );
    const { result } = renderHook(() => useRemovalRequest());

    act(() => {
      result.current.phone.onChange("61999990002");
    });
    act(() => {
      result.current.submit();
    });

    await waitFor(() => {
      expect(result.current.state).toBe("idle");
    });
    expect(result.current.error).toBe("Muitos pedidos hoje. Tente de novo amanhã.");
  });
});
