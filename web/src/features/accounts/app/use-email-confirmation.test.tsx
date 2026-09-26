// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as gateway from "../adapters/accounts-gateway";
import type { Account } from "../domain/account";
import { SESSION_KEY } from "./use-session";
import { useEmailConfirmation } from "./use-email-confirmation";

vi.mock("../adapters/accounts-gateway");

const mocked = vi.mocked(gateway);

const confirmed: Account = {
  id: "a1",
  phone: "+5561999990001",
  phoneDisplay: "(61) 99999-0001",
  displayName: "Ana",
  email: "ana-nova@example.com",
  emailConfirmed: true,
  requiredAction: null,
  cars: [],
  canDrive: false,
};

function renderConfirmation() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const rendered = renderHook(() => useEmailConfirmation(), { wrapper });
  return { ...rendered, client };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("useEmailConfirmation", () => {
  it("starts on the form: no server state to resume, unlike an invite (D-168)", () => {
    const { result } = renderConfirmation();

    expect(result.current.view).toMatchObject({ status: "form", sending: false });
  });

  it("requesting the link moves to sent, with the typed address", async () => {
    mocked.requestEmailChange.mockResolvedValue(undefined);
    const { result } = renderConfirmation();

    await act(async () => {
      if (result.current.view.status === "form") {
        await result.current.view.requestLink("ana-nova@example.com");
      }
    });

    expect(mocked.requestEmailChange).toHaveBeenCalledWith("ana-nova@example.com");
    expect(result.current.view).toMatchObject({ status: "sent", email: "ana-nova@example.com" });
  });

  it("resends the same address that was typed", async () => {
    mocked.requestEmailChange.mockResolvedValue(undefined);
    const { result } = renderConfirmation();
    await act(async () => {
      if (result.current.view.status === "form") {
        await result.current.view.requestLink("ana-nova@example.com");
      }
    });
    mocked.requestEmailChange.mockClear();

    await act(async () => {
      if (result.current.view.status === "sent") await result.current.view.resend();
    });

    expect(mocked.requestEmailChange).toHaveBeenCalledWith("ana-nova@example.com");
  });

  it("'usar outro e-mail' goes back to the form", async () => {
    mocked.requestEmailChange.mockResolvedValue(undefined);
    const { result } = renderConfirmation();
    await act(async () => {
      if (result.current.view.status === "form") {
        await result.current.view.requestLink("ana-nova@example.com");
      }
    });
    expect(result.current.view.status).toBe("sent");

    act(() => {
      if (result.current.view.status === "sent") result.current.view.useAnotherEmail();
    });

    expect(result.current.view.status).toBe("form");
  });

  it("confirming the link's token updates the session's own query with the account it returns", async () => {
    mocked.confirmEmail.mockResolvedValue(confirmed);
    const { result, client } = renderConfirmation();

    const account = await act(() => result.current.confirm("tok-1"));

    expect(mocked.confirmEmail).toHaveBeenCalledWith("tok-1", expect.anything());
    expect(account).toEqual(confirmed);
    expect(client.getQueryData(SESSION_KEY)).toEqual(confirmed);
  });

  it("a refused confirmation rejects without touching the session", async () => {
    mocked.confirmEmail.mockRejectedValue(new Error("Link inválido ou vencido."));
    const { result, client } = renderConfirmation();

    await expect(act(() => result.current.confirm("old"))).rejects.toThrow(
      "Link inválido ou vencido.",
    );
    expect(client.getQueryData(SESSION_KEY)).toBeUndefined();
  });
});
