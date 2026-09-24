// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as gateway from "../adapters/rides-gateway";
import { RideRequestError } from "../domain/ride";
import { useContact } from "./use-contact";

vi.mock("../adapters/rides-gateway");

const mocked = vi.mocked(gateway);

function renderContact() {
  const client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useContact("r1"), { wrapper });
}

describe("useContact", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("asks once and keeps the link and the plate the API handed out", async () => {
    const contact = {
      whatsappUrl: "https://wa.me/5561999990001?text=Oi",
      phoneDisplay: "(61) 99999-0001",
      plate: "ABC1234",
    };
    mocked.requestContact.mockResolvedValue(contact);
    const { result } = renderContact();
    expect(result.current.contact).toBeNull();

    const handed = await act(() => result.current.request());

    expect(handed).toEqual(contact);
    await waitFor(() => {
      expect(result.current.contact).toEqual(contact);
    });
    expect(mocked.requestContact).toHaveBeenCalledWith("r1");
  });

  it("surfaces the API's refusal and keeps nothing", async () => {
    mocked.requestContact.mockRejectedValue(
      new RideRequestError(429, "muitos pedidos de contato; tente depois"),
    );
    const { result } = renderContact();

    await expect(act(() => result.current.request())).rejects.toMatchObject({
      status: 429,
      message: "muitos pedidos de contato; tente depois",
    });

    expect(result.current.contact).toBeNull();
  });
});
