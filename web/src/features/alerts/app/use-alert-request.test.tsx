// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AlertRequestError, type AlertData } from "../domain/alert";
import { alertKeys } from "./keys";
import { useAlertRequest } from "./use-alert-request";

const api = await vi.hoisted(async () => {
  const { installFakeApi } = await import("@/shared/testing/fake-api");
  return installFakeApi();
});

const data: AlertData = { day: "2026-09-26", text: null, fromTime: null, untilTime: null };
const created = {
  id: "a1",
  text: null,
  day: "2026-09-26",
  from_time: null,
  until_time: null,
  created_at: "2026-09-24T12:00:00-03:00",
};

function renderRequest(enable: () => Promise<void>) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const invalidate = vi.spyOn(client, "invalidateQueries");
  const hook = renderHook(() => useAlertRequest({ accountId: "acc", push: { enable } }), {
    wrapper,
  });
  return { ...hook, invalidate };
}

beforeEach(() => {
  api.reset();
});

describe("useAlertRequest", () => {
  it("asks for push first, with nothing sent yet, and posts only after it answers", async () => {
    let finish: () => void = () => undefined;
    let sentWhenCalled = -1;
    const enable = vi.fn(() => {
      sentWhenCalled = api.sent.length;
      return new Promise<void>((resolve) => {
        finish = resolve;
      });
    });
    api.answer(201, created);
    const { result, invalidate } = renderRequest(enable);

    act(() => {
      result.current.submit(data);
    });

    expect(enable).toHaveBeenCalledOnce();
    expect(sentWhenCalled).toBe(0);
    expect(api.sent).toHaveLength(0);
    expect(result.current.busy).toBe(true);

    await act(async () => {
      finish();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.phase).toBe("created");
    });
    expect(api.last()).toMatchObject({ method: "POST", path: "/api/alerts" });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: alertKeys.mine("acc") });
    expect(result.current.busy).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("creates the alert even when push did not turn on", async () => {
    api.answer(201, created);
    const { result } = renderRequest(() => Promise.resolve());

    act(() => {
      result.current.submit(data);
    });

    await waitFor(() => {
      expect(result.current.phase).toBe("created");
    });
    expect(api.sentTo("POST", "/api/alerts")).toHaveLength(1);
  });

  it("keeps editing, with the error, when the API refuses with a sentence", async () => {
    api.answer(422, { detail: "Você já tem 5 avisos." });
    const { result } = renderRequest(() => Promise.resolve());

    act(() => {
      result.current.submit(data);
    });

    await waitFor(() => {
      expect(result.current.error).toBeInstanceOf(AlertRequestError);
    });
    expect(result.current.phase).toBe("editing");
    expect(result.current.error).toMatchObject({ message: "Você já tem 5 avisos." });
    expect(result.current.busy).toBe(false);
  });

  it("goes back to editing on reset", async () => {
    api.answer(201, created);
    const { result } = renderRequest(() => Promise.resolve());
    act(() => {
      result.current.submit(data);
    });
    await waitFor(() => {
      expect(result.current.phase).toBe("created");
    });

    act(() => {
      result.current.reset();
    });

    await waitFor(() => {
      expect(result.current.phase).toBe("editing");
    });
  });

  it("still posts if the push call rejects", async () => {
    api.answer(201, created);
    const { result } = renderRequest(() => Promise.reject(new Error("boom")));

    act(() => {
      result.current.submit(data);
    });

    await waitFor(() => {
      expect(result.current.phase).toBe("created");
    });
  });
});
