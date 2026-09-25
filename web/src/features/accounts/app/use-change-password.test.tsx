// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as gateway from "../adapters/accounts-gateway";
import { AccountRequestError } from "../domain/account";
import { useChangePassword } from "./use-change-password";

vi.mock("../adapters/accounts-gateway");

const mocked = vi.mocked(gateway);

function renderChangePassword() {
  const client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useChangePassword(), { wrapper });
}

describe("useChangePassword", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("calls the gateway with the current and new password, and settles busy back to false", async () => {
    mocked.changePassword.mockResolvedValue(undefined);
    const { result } = renderChangePassword();
    expect(result.current.busy).toBe(false);

    await act(() => result.current.changePassword({ currentPassword: "old", newPassword: "new" }));

    expect(mocked.changePassword).toHaveBeenCalledWith(
      { currentPassword: "old", newPassword: "new" },
      expect.anything(),
    );
    expect(result.current.busy).toBe(false);
  });

  it("surfaces the API's refusal", async () => {
    mocked.changePassword.mockRejectedValue(
      new AccountRequestError(403, "senha atual não confere"),
    );
    const { result } = renderChangePassword();

    await expect(
      act(() => result.current.changePassword({ currentPassword: "old", newPassword: "new" })),
    ).rejects.toThrow("senha atual não confere");
    await waitFor(() => {
      expect(result.current.busy).toBe(false);
    });
  });
});
