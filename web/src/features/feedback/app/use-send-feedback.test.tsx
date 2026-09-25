// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as gateway from "../adapters/feedback-gateway";
import { useSendFeedback } from "./use-send-feedback";

vi.mock("../adapters/feedback-gateway");

const mocked = vi.mocked(gateway);

function renderSendFeedback() {
  const client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useSendFeedback(), { wrapper });
}

describe("useSendFeedback", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("sends the opinion and settles busy back to false", async () => {
    mocked.sendFeedback.mockResolvedValue(undefined);
    const { result } = renderSendFeedback();
    expect(result.current.busy).toBe(false);

    await act(() =>
      result.current.send({ kind: "praise", message: "Muito bom!", aboutPhone: null }),
    );

    expect(mocked.sendFeedback).toHaveBeenCalledWith({
      kind: "praise",
      message: "Muito bom!",
      aboutPhone: null,
    });
    expect(result.current.busy).toBe(false);
  });
});
