import { afterEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/shared/adapters/api/client";
import type { components } from "@/shared/adapters/api/schema";

import { AccountRequestError } from "../domain/account";
import {
  addCar,
  changePassword,
  confirmPasswordReset,
  deleteAccount,
  fetchCurrentAccount,
  logIn,
  logOut,
  removeCar,
  requestPasswordReset,
  signUp,
  updateProfile,
} from "./accounts-gateway";

vi.mock("@/shared/adapters/api/client", () => ({
  apiClient: { GET: vi.fn(), POST: vi.fn(), PATCH: vi.fn(), DELETE: vi.fn() },
}));

const get = vi.mocked(apiClient.GET);
const post = vi.mocked(apiClient.POST);
const patch = vi.mocked(apiClient.PATCH);
const del = vi.mocked(apiClient.DELETE);

afterEach(() => {
  vi.resetAllMocks();
});

const ACCOUNT_OUT: components["schemas"]["AccountOut"] = {
  id: "a1",
  phone: "+5561999990001",
  phone_display: "(61) 99999-0001",
  display_name: "Ana",
  email: "ana@example.org",
  cars: [],
  can_drive: false,
  terms_accepted_at: "2026-01-01T00:00:00-03:00",
};

const ACCOUNT = {
  id: "a1",
  phone: "+5561999990001",
  phoneDisplay: "(61) 99999-0001",
  displayName: "Ana",
  email: "ana@example.org",
  cars: [],
  canDrive: false,
};

describe("fetchCurrentAccount", () => {
  it("returns the signed-in account", async () => {
    get.mockResolvedValue({ data: ACCOUNT_OUT, response: { status: 200 } });
    await expect(fetchCurrentAccount(new AbortController().signal)).resolves.toEqual(ACCOUNT);
  });

  it("is null with no session (401 is not an error here)", async () => {
    get.mockResolvedValue({ data: undefined, response: { status: 401 } });
    await expect(fetchCurrentAccount(new AbortController().signal)).resolves.toBeNull();
  });

  it("throws on any other failure", async () => {
    get.mockResolvedValue({ data: undefined, response: { status: 500 } });
    await expect(fetchCurrentAccount(new AbortController().signal)).rejects.toBeInstanceOf(
      AccountRequestError,
    );
  });
});

describe("signUp", () => {
  it("clears a blank e-mail and keeps the rest", async () => {
    post.mockResolvedValue({
      data: ACCOUNT_OUT,
      error: undefined,
      response: { status: 201 },
    });
    await signUp({
      phone: "61 99999-0001",
      password: "correct horse battery",
      displayName: "Ana",
      email: "  ",
      acceptsTerms: true,
    });
    expect(post).toHaveBeenCalledWith("/api/accounts/register", {
      body: {
        phone: "61 99999-0001",
        password: "correct horse battery",
        display_name: "Ana",
        email: null,
        accepts_terms: true,
      },
    });
  });

  it("throws the API's refusal", async () => {
    post.mockResolvedValue({
      data: undefined,
      error: { detail: "este telefone já tem conta" },
      response: { status: 409 },
    });
    await expect(
      signUp({
        phone: "61 99999-0001",
        password: "x",
        displayName: "Ana",
        email: "",
        acceptsTerms: true,
      }),
    ).rejects.toMatchObject({ status: 409, message: "este telefone já tem conta" });
  });
});

describe("logIn", () => {
  it("returns the account on success", async () => {
    post.mockResolvedValue({
      data: ACCOUNT_OUT,
      error: undefined,
      response: { status: 200 },
    });
    await expect(logIn({ phone: "61 99999-0001", password: "x" })).resolves.toEqual(ACCOUNT);
  });
});

describe("logOut", () => {
  it("resolves on success", async () => {
    post.mockResolvedValue({ response: { ok: true } });
    await expect(logOut()).resolves.toBeUndefined();
  });

  it("throws when the API refuses", async () => {
    post.mockResolvedValue({ response: { ok: false, status: 500 } });
    await expect(logOut()).rejects.toBeInstanceOf(AccountRequestError);
  });
});

describe("updateProfile", () => {
  it("sends only the fields the caller touched", async () => {
    patch.mockResolvedValue({
      data: ACCOUNT_OUT,
      error: undefined,
      response: { status: 200 },
    } as never);
    await updateProfile({ displayName: "Ana Paula" });
    expect(patch).toHaveBeenCalledWith("/api/accounts/me", { body: { display_name: "Ana Paula" } });
  });

  it("sends a blank e-mail as is: it clears the field (D-139)", async () => {
    patch.mockResolvedValue({
      data: ACCOUNT_OUT,
      error: undefined,
      response: { status: 200 },
    } as never);
    await updateProfile({ email: "" });
    expect(patch).toHaveBeenCalledWith("/api/accounts/me", { body: { email: "" } });
  });
});

describe("changePassword", () => {
  it("resolves on success", async () => {
    post.mockResolvedValue({ error: undefined, response: { ok: true } });
    await expect(
      changePassword({ currentPassword: "old", newPassword: "new" }),
    ).resolves.toBeUndefined();
    expect(post).toHaveBeenCalledWith("/api/accounts/me/password", {
      body: { current_password: "old", new_password: "new" },
    });
  });

  it("throws the API's refusal, e.g. the wrong current password", async () => {
    post.mockResolvedValue({
      error: { detail: "senha atual não confere" },
      response: { ok: false, status: 403 },
    });
    await expect(
      changePassword({ currentPassword: "old", newPassword: "new" }),
    ).rejects.toMatchObject({
      status: 403,
      message: "senha atual não confere",
    });
  });
});

describe("addCar and removeCar", () => {
  it("addCar posts the car and returns the account", async () => {
    post.mockResolvedValue({
      data: ACCOUNT_OUT,
      error: undefined,
      response: { status: 200 },
    });
    await expect(addCar({ model: "Gol", color: "prata", plate: "ABC1234" })).resolves.toEqual(
      ACCOUNT,
    );
  });

  it("removeCar deletes by id and returns the account", async () => {
    del.mockResolvedValue({
      data: ACCOUNT_OUT,
      error: undefined,
      response: { status: 200 },
    } as never);
    await expect(removeCar("c1")).resolves.toEqual(ACCOUNT);
    expect(del).toHaveBeenCalledWith("/api/accounts/cars/{car_id}", {
      params: { path: { car_id: "c1" } },
    });
  });
});

describe("password reset", () => {
  it("requestPasswordReset resolves on success and throws otherwise", async () => {
    post.mockResolvedValue({ response: { ok: true } });
    await expect(requestPasswordReset("61 99999-0001")).resolves.toBeUndefined();

    post.mockResolvedValue({ response: { ok: false, status: 500 } });
    await expect(requestPasswordReset("61 99999-0001")).rejects.toBeInstanceOf(AccountRequestError);
  });

  it("confirmPasswordReset resolves on success and throws the API's refusal otherwise", async () => {
    post.mockResolvedValue({ error: undefined, response: { ok: true } });
    await expect(confirmPasswordReset("tok", "correct horse battery")).resolves.toBeUndefined();

    post.mockResolvedValue({
      error: { detail: "link inválido ou vencido" },
      response: { ok: false, status: 400 },
    });
    await expect(confirmPasswordReset("tok", "correct horse battery")).rejects.toMatchObject({
      status: 400,
      message: "link inválido ou vencido",
    });
  });
});

describe("deleteAccount", () => {
  it("resolves on success and throws otherwise", async () => {
    del.mockResolvedValue({ response: { ok: true } } as never);
    await expect(deleteAccount()).resolves.toBeUndefined();

    del.mockResolvedValue({ response: { ok: false, status: 500 } } as never);
    await expect(deleteAccount()).rejects.toBeInstanceOf(AccountRequestError);
  });
});
