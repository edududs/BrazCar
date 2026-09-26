// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as gateway from "../adapters/accounts-gateway";
import { AccountRequestError, type OpenSignup } from "../domain/account";
import { useOpenSignup } from "./use-open-signup";

vi.mock("../adapters/accounts-gateway");

const mocked = vi.mocked(gateway);

const opened: OpenSignup = {
  phoneMasked: "+5561*****0001",
  email: "ana@example.com",
  emailExpiresAt: "2026-09-01T12:00:00-03:00",
};

function renderOpenSignup(emailToken: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useOpenSignup(emailToken), { wrapper });
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("useOpenSignup", () => {
  it("without a token there is nothing to ask the API", () => {
    const { result } = renderOpenSignup("");

    expect(result.current).toEqual({ signup: null, status: "refused", reason: null });
    expect(mocked.openSignup).not.toHaveBeenCalled();
  });

  it("is loading, then ready with what the invite's link carries", async () => {
    mocked.openSignup.mockResolvedValue(opened);

    const { result } = renderOpenSignup("tok-1");

    expect(result.current.status).toBe("loading");
    await waitFor(() => {
      expect(result.current.status).toBe("ready");
    });
    expect(result.current.signup).toEqual(opened);
    expect(mocked.openSignup).toHaveBeenCalledWith("tok-1", expect.any(AbortSignal));
  });

  it("a spent or lapsed link is refused with the API's own words", async () => {
    mocked.openSignup.mockRejectedValue(
      new AccountRequestError(410, "Link vencido. Peça um convite novo."),
    );

    const { result } = renderOpenSignup("old");

    await waitFor(() => {
      expect(result.current.status).toBe("refused");
    });
    expect(result.current.reason).toBe("Link vencido. Peça um convite novo.");
    expect(result.current.signup).toBeNull();
  });
});
