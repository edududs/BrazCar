// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as gateway from "../adapters/accounts-gateway";
import type { Account } from "../domain/account";
import { useCanSeePeople } from "./use-can-see-people";

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
const mocked = vi.mocked(gateway);

function renderVisibility() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useCanSeePeople(), { wrapper });
}

describe("useCanSeePeople", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("is checking while the session settles, never visible before that", async () => {
    let resolve: (account: Account | null) => void = () => undefined;
    mocked.fetchCurrentAccount.mockImplementation(
      () =>
        new Promise((accept) => {
          resolve = accept;
        }),
    );

    const { result } = renderVisibility();

    expect(result.current).toBe("checking");
    resolve(ana);
    await waitFor(() => {
      expect(result.current).toBe("visible");
    });
  });

  it("is hidden for a visitor with no session", async () => {
    mocked.fetchCurrentAccount.mockResolvedValue(null);

    const { result } = renderVisibility();

    await waitFor(() => {
      expect(result.current).toBe("hidden");
    });
  });

  it("is visible once someone is signed in", async () => {
    mocked.fetchCurrentAccount.mockResolvedValue(ana);

    const { result } = renderVisibility();

    await waitFor(() => {
      expect(result.current).toBe("visible");
    });
  });
});
