// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as gateway from "../adapters/accounts-gateway";
import type { Account } from "../domain/account";
import { useConfirmEmailLink } from "./use-confirm-email-link";

vi.mock("../adapters/accounts-gateway");

const { navigateMock } = vi.hoisted(() => ({ navigateMock: vi.fn() }));
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return { ...actual, useNavigate: () => navigateMock };
});

const mocked = vi.mocked(gateway);

const confirmed: Account = {
  id: "a1",
  phone: "+5561999990001",
  phoneDisplay: "(61) 99999-0001",
  displayName: "Ana",
  email: "ana@example.com",
  emailConfirmed: true,
  requiredAction: null,
  cars: [],
  canDrive: false,
};

function renderLink(token: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useConfirmEmailLink(token), { wrapper });
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("useConfirmEmailLink (D-168)", () => {
  it("starts checking the session", () => {
    mocked.fetchCurrentAccount.mockResolvedValue(null);
    const { result } = renderLink("tok-1");

    expect(result.current).toEqual({ status: "checking" });
  });

  it("without a session, asks to sign in and carries the way back", async () => {
    mocked.fetchCurrentAccount.mockResolvedValue(null);
    const { result } = renderLink("tok-1");

    await waitFor(() => {
      expect(result.current).toEqual({
        status: "needs-sign-in",
        returnTo: "/confirmar-email?token=tok-1",
      });
    });
    expect(mocked.confirmEmail).not.toHaveBeenCalled();
  });

  it("with a session, confirms on its own and leaves once done", async () => {
    mocked.fetchCurrentAccount.mockResolvedValue(confirmed);
    mocked.confirmEmail.mockResolvedValue(confirmed);
    const { result } = renderLink("tok-1");

    await waitFor(() => {
      expect(mocked.confirmEmail).toHaveBeenCalledWith("tok-1", expect.anything());
    });
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith({
        to: "/conta",
        state: { flash: { message: "E-mail confirmado." } },
      });
    });
    expect(result.current.status).toBe("confirming");
  });

  it("a refused link says so, without trying a second time", async () => {
    mocked.fetchCurrentAccount.mockResolvedValue(confirmed);
    mocked.confirmEmail.mockRejectedValue(new Error("Link inválido ou vencido."));
    const { result } = renderLink("old");

    await waitFor(() => {
      expect(result.current).toEqual({ status: "refused" });
    });
    expect(mocked.confirmEmail).toHaveBeenCalledTimes(1);
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
