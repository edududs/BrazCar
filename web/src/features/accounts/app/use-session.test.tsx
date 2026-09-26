// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as gateway from "../adapters/accounts-gateway";
import { type Account, AccountRequestError } from "../domain/account";
import { useSession } from "./use-session";

vi.mock("../adapters/accounts-gateway");

const ana: Account = {
  id: "a1",
  phone: "+5561999990001",
  phoneDisplay: "(61) 99999-0001",
  displayName: "Ana",
  email: null,
  emailConfirmed: true,
  requiredAction: null,
  cars: [],
  canDrive: false,
};
const driving: Account = {
  ...ana,
  cars: [{ id: "c1", model: "Gol", color: "prata", plate: "ABC1234" }],
  canDrive: true,
};
const mocked = vi.mocked(gateway);

function renderSession() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useSession(), { wrapper });
}

describe("useSession", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("starts checking and settles on anonymous when there is no cookie", async () => {
    mocked.fetchCurrentAccount.mockResolvedValue(null);

    const { result } = renderSession();

    expect(result.current.session.status).toBe("checking");
    await waitFor(() => {
      expect(result.current.session.status).toBe("anonymous");
    });
  });

  it("logging in signs the session in without a second fetch", async () => {
    mocked.fetchCurrentAccount.mockResolvedValue(null);
    mocked.logIn.mockResolvedValue(ana);
    const { result } = renderSession();
    await waitFor(() => {
      expect(result.current.session.status).toBe("anonymous");
    });

    await act(async () => {
      await result.current.logIn({ phone: "61 99999-0001", password: "correct horse battery" });
    });

    await waitFor(() => {
      expect(result.current.session).toEqual({ status: "signed-in", account: ana });
    });
    expect(mocked.fetchCurrentAccount).toHaveBeenCalledTimes(1);
  });

  it("a refused login keeps the session anonymous and surfaces the reason", async () => {
    mocked.fetchCurrentAccount.mockResolvedValue(null);
    mocked.logIn.mockRejectedValue(new AccountRequestError(401, "telefone ou senha incorretos"));
    const { result } = renderSession();
    await waitFor(() => {
      expect(result.current.session.status).toBe("anonymous");
    });

    await expect(
      act(() => result.current.logIn({ phone: "61 99999-0001", password: "nope" })),
    ).rejects.toMatchObject({ status: 401, message: "telefone ou senha incorretos" });
    expect(result.current.session.status).toBe("anonymous");
  });

  it("adding a car updates the signed-in account, and logging out forgets it", async () => {
    mocked.fetchCurrentAccount.mockResolvedValue(ana);
    mocked.addCar.mockResolvedValue(driving);
    mocked.logOut.mockResolvedValue(undefined);
    const { result } = renderSession();
    await waitFor(() => {
      expect(result.current.session.status).toBe("signed-in");
    });

    await act(async () => {
      await result.current.addCar({ model: "Gol", color: "prata", plate: "abc1234" });
    });
    await waitFor(() => {
      expect(result.current.session).toEqual({ status: "signed-in", account: driving });
    });

    await act(async () => {
      await result.current.logOut();
    });
    await waitFor(() => {
      expect(result.current.session.status).toBe("anonymous");
    });
  });

  it("requesting an e-mail change leaves the signed-in account exactly as it was (D-168)", async () => {
    mocked.fetchCurrentAccount.mockResolvedValue(ana);
    mocked.requestEmailChange.mockResolvedValue(undefined);
    const { result } = renderSession();
    await waitFor(() => {
      expect(result.current.session.status).toBe("signed-in");
    });

    await act(async () => {
      await result.current.requestEmailChange("ana-nova@example.com");
    });

    expect(mocked.requestEmailChange).toHaveBeenCalledWith(
      "ana-nova@example.com",
      expect.anything(),
    );
    expect(result.current.session).toEqual({ status: "signed-in", account: ana });
  });
});
