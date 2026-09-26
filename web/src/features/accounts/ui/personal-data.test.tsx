// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderRouted } from "@/shared/testing/render-routed";

import * as gateway from "../adapters/accounts-gateway";
import type { Account } from "../domain/account";
import { PersonalData } from "./personal-data";

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

beforeEach(() => {
  vi.resetAllMocks();
});

describe("PersonalData", () => {
  it("draws a skeleton, never the content, while the session is still checking", async () => {
    mocked.fetchCurrentAccount.mockImplementation(() => new Promise(() => undefined));

    const { container } = renderRouted(
      <PersonalData fallback="line">Ana Paula Ribeiro</PersonalData>,
    );

    // The account query never settles in this test; this waits only for the router itself to
    // mount, not for anything session-related.
    await waitFor(() => {
      expect(container.querySelector("[aria-hidden]")).not.toBeNull();
    });
    expect(screen.queryByText("Ana Paula Ribeiro")).toBeNull();
  });

  it("draws a skeleton and never the content for a visitor with no session", async () => {
    mocked.fetchCurrentAccount.mockResolvedValue(null);

    const { container } = renderRouted(
      <PersonalData fallback="block">Obrigado pela carona.</PersonalData>,
    );

    await waitFor(() => {
      expect(mocked.fetchCurrentAccount).toHaveBeenCalled();
    });
    expect(screen.queryByText("Obrigado pela carona.")).toBeNull();
    expect(container.querySelector("[aria-hidden]")).not.toBeNull();
  });

  it("draws the content, and no skeleton, once someone is signed in", async () => {
    mocked.fetchCurrentAccount.mockResolvedValue(ana);

    const { container } = renderRouted(
      <PersonalData fallback="line">Ana Paula Ribeiro</PersonalData>,
    );

    await screen.findByText("Ana Paula Ribeiro");
    expect(container.querySelector("[aria-hidden]")).toBeNull();
  });

  it("draws nothing, not a skeleton, when a signed-in visitor's ride simply has none of this fact", async () => {
    mocked.fetchCurrentAccount.mockResolvedValue(ana);

    const { container } = renderRouted(<PersonalData fallback="line">{null}</PersonalData>);

    await waitFor(() => {
      expect(container.querySelector("[aria-hidden]")).toBeNull();
    });
    expect(container.textContent).toBe("");
  });
});
