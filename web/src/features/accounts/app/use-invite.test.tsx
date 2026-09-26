// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as gateway from "../adapters/accounts-gateway";
import { AccountRequestError, type Invite } from "../domain/account";
import { useInvite } from "./use-invite";

vi.mock("../adapters/accounts-gateway");

const mocked = vi.mocked(gateway);

const open: Invite = {
  status: "open",
  phoneMasked: "+5561*****0001",
  emailMasked: null,
  expiresAt: "2026-09-01T14:00:00-03:00",
};

const awaiting: Invite = {
  status: "awaiting_email_confirmation",
  phoneMasked: "+5561*****0001",
  emailMasked: "a**@example.com",
  expiresAt: "2026-09-01T14:00:00-03:00",
};

function renderInvite(token: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useInvite(token), { wrapper });
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("useInvite", () => {
  it("without a token there is nothing to ask the API", () => {
    const { result } = renderInvite("");

    expect(result.current).toEqual({ status: "refused", reason: null });
    expect(mocked.openInvite).not.toHaveBeenCalled();
  });

  it("is loading, then open with the invite's own facts", async () => {
    mocked.openInvite.mockResolvedValue(open);

    const { result } = renderInvite("tok-1");

    expect(result.current.status).toBe("loading");
    await waitFor(() => {
      expect(result.current.status).toBe("open");
    });
    expect(result.current).toMatchObject({ invite: open, sending: false });
    expect(mocked.openInvite).toHaveBeenCalledWith("tok-1", expect.any(AbortSignal));
  });

  it("a spent, superseded or unknown invite is refused with the API's own words", async () => {
    mocked.openInvite.mockRejectedValue(
      new AccountRequestError(410, "Convite vencido. Peça um convite novo."),
    );

    const { result } = renderInvite("old");

    await waitFor(() => {
      expect(result.current.status).toBe("refused");
    });
    expect(result.current).toEqual({
      status: "refused",
      reason: "Convite vencido. Peça um convite novo.",
    });
  });

  it("giving the e-mail moves to sent, with the typed address and a way to resend it", async () => {
    mocked.openInvite.mockResolvedValue(open);
    mocked.giveInviteEmail.mockResolvedValue();

    const { result } = renderInvite("tok-1");
    await waitFor(() => {
      expect(result.current.status).toBe("open");
    });

    await act(async () => {
      if (result.current.status === "open") await result.current.giveEmail("ana@example.com");
    });

    expect(mocked.giveInviteEmail).toHaveBeenCalledWith("tok-1", "ana@example.com");
    expect(result.current).toMatchObject({
      status: "sent",
      email: "ana@example.com",
      canResend: true,
    });
  });

  it("an invite already awaiting confirmation opens straight into sent, with only the mask", async () => {
    mocked.openInvite.mockResolvedValue(awaiting);

    const { result } = renderInvite("tok-1");

    await waitFor(() => {
      expect(result.current.status).toBe("sent");
    });
    expect(result.current).toMatchObject({
      status: "sent",
      email: "a**@example.com",
      canResend: false,
    });
  });

  it("resends the same address that was typed", async () => {
    mocked.openInvite.mockResolvedValue(open);
    mocked.giveInviteEmail.mockResolvedValue();

    const { result } = renderInvite("tok-1");
    await waitFor(() => {
      expect(result.current.status).toBe("open");
    });
    await act(async () => {
      if (result.current.status === "open") await result.current.giveEmail("ana@example.com");
    });
    mocked.giveInviteEmail.mockClear();

    await act(async () => {
      if (result.current.status === "sent") await result.current.resend();
    });

    expect(mocked.giveInviteEmail).toHaveBeenCalledWith("tok-1", "ana@example.com");
  });

  it("a 429 while sending is the API's own limit, never one invented here", async () => {
    mocked.openInvite.mockResolvedValue(open);
    mocked.giveInviteEmail.mockRejectedValue(
      new AccountRequestError(429, "Muitos envios. Espere um pouco."),
    );

    const { result } = renderInvite("tok-1");
    await waitFor(() => {
      expect(result.current.status).toBe("open");
    });

    await expect(
      act(async () => {
        if (result.current.status === "open") await result.current.giveEmail("ana@example.com");
      }),
    ).rejects.toMatchObject({ status: 429, message: "Muitos envios. Espere um pouco." });
  });

  it("'usar outro e-mail' goes back to the form even after sending", async () => {
    mocked.openInvite.mockResolvedValue(open);
    mocked.giveInviteEmail.mockResolvedValue();

    const { result } = renderInvite("tok-1");
    await waitFor(() => {
      expect(result.current.status).toBe("open");
    });
    await act(async () => {
      if (result.current.status === "open") await result.current.giveEmail("ana@example.com");
    });
    expect(result.current.status).toBe("sent");

    act(() => {
      if (result.current.status === "sent") result.current.useAnotherEmail();
    });

    expect(result.current.status).toBe("open");
  });
});
