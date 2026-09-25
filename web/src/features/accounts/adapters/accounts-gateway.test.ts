import { beforeEach, describe, expect, it, vi } from "vitest";

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

const api = await vi.hoisted(async () => {
  const { installFakeApi } = await import("@/shared/testing/fake-api");
  return installFakeApi();
});

const accountOut: components["schemas"]["AccountOut"] = {
  id: "a1",
  phone: "+5561999990001",
  phone_display: "(61) 99999-0001",
  display_name: "Ana",
  email: "ana@example.com",
  cars: [{ id: "c1", model: "Gol", color: "prata", plate: "ABC1D23" }],
  can_drive: true,
  terms_accepted_at: "2026-09-01T10:00:00-03:00",
};

const signal = new AbortController().signal;

beforeEach(() => {
  api.reset();
});

describe("the current session", () => {
  it("turns the API's account into the screen's, leaving the terms date behind", async () => {
    api.answer(200, accountOut);

    const account = await fetchCurrentAccount(signal);

    expect(api.last()).toMatchObject({ method: "GET", path: "/api/accounts/me" });
    expect(account).toEqual({
      id: "a1",
      phone: "+5561999990001",
      phoneDisplay: "(61) 99999-0001",
      displayName: "Ana",
      email: "ana@example.com",
      cars: [{ id: "c1", model: "Gol", color: "prata", plate: "ABC1D23" }],
      canDrive: true,
    });
  });

  it("no session (401) is an answer, not an error: nobody is signed in", async () => {
    api.answer(401, { detail: "Não autenticado." });

    await expect(fetchCurrentAccount(signal)).resolves.toBeNull();
  });

  it("any other failure is an error, so the screen does not show a signed-out page by mistake", async () => {
    api.answerText(503, "Service Unavailable");

    await expect(fetchCurrentAccount(signal)).rejects.toMatchObject({
      status: 503,
      message: "Não foi possível verificar a sessão.",
    });
  });

  it("a missing e-mail reaches the screen as null", async () => {
    api.answer(200, { ...accountOut, email: undefined }); // JSON leaves the key out

    const account = await fetchCurrentAccount(signal);

    expect(account?.email).toBeNull();
  });
});

describe("signing up and in", () => {
  it("signs up with the API's names, a blank e-mail sent as null", async () => {
    api.answer(201, accountOut);

    await signUp({
      phone: "+5561999990001",
      password: "segredo123",
      displayName: "Ana",
      email: "  ",
      acceptsTerms: true,
    });

    expect(api.last()).toMatchObject({
      method: "POST",
      path: "/api/accounts/register",
      credentials: "include",
      body: {
        phone: "+5561999990001",
        password: "segredo123",
        display_name: "Ana",
        email: null,
        accepts_terms: true,
      },
    });
  });

  it("signs up with a written e-mail as it is", async () => {
    api.answer(201, accountOut);

    await signUp({
      phone: "+5561999990001",
      password: "segredo123",
      displayName: "Ana",
      email: "ana@example.com",
      acceptsTerms: true,
    });

    expect(api.last().body).toMatchObject({ email: "ana@example.com" });
  });

  it("a taken phone comes back as the API's sentence", async () => {
    api.answer(409, { detail: "Este celular já tem conta." });

    const attempt = signUp({
      phone: "+5561999990001",
      password: "segredo123",
      displayName: "Ana",
      email: "",
      acceptsTerms: true,
    });

    await expect(attempt).rejects.toBeInstanceOf(AccountRequestError);
    await expect(attempt).rejects.toMatchObject({
      status: 409,
      message: "Este celular já tem conta.",
    });
  });

  it("logs in with phone and password and hands the account back", async () => {
    api.answer(200, accountOut);

    const account = await logIn({ phone: "+5561999990001", password: "segredo123" });

    expect(api.last()).toMatchObject({
      path: "/api/accounts/login",
      body: { phone: "+5561999990001", password: "segredo123" },
    });
    expect(account.displayName).toBe("Ana");
  });

  it("too many attempts (429) pass the API's words on", async () => {
    api.answer(429, { detail: "Muitas tentativas. Espere um pouco." });

    await expect(logIn({ phone: "+55", password: "x" })).rejects.toMatchObject({
      status: 429,
      message: "Muitas tentativas. Espere um pouco.",
    });
  });

  it("a validation list becomes one line asking to check the data", async () => {
    api.answer(422, { detail: [{ loc: ["body", "phone"], msg: "bad" }] });

    await expect(logIn({ phone: "1", password: "x" })).rejects.toMatchObject({
      message: "Confira os dados informados.",
    });
  });

  it("with the network down the failure is not dressed as a refusal", async () => {
    api.dropConnection();

    const attempt = logIn({ phone: "+5561999990001", password: "x" });

    await expect(attempt).rejects.toBeInstanceOf(TypeError);
  });

  it("logs out, and says so when the API does not let go", async () => {
    api.answerEmpty(204);
    await logOut();
    expect(api.last()).toMatchObject({ method: "POST", path: "/api/accounts/logout" });

    api.answer(500, { detail: "boom" });
    await expect(logOut()).rejects.toMatchObject({
      status: 500,
      message: "Não foi possível sair.",
    });
  });
});

describe("editing the account", () => {
  it("sends only the profile fields that changed", async () => {
    api.answer(200, accountOut);

    await updateProfile({ displayName: "Ana Paula" });

    expect(api.last()).toMatchObject({
      method: "PATCH",
      path: "/api/accounts/me",
      body: { display_name: "Ana Paula" },
    });
    expect(api.last().body).not.toHaveProperty("email");
  });

  it("an empty e-mail goes as empty, which clears it (D-139)", async () => {
    api.answer(200, { ...accountOut, email: null });

    const account = await updateProfile({ email: "" });

    expect(api.last().body).toEqual({ email: "" });
    expect(account.email).toBeNull();
  });

  it("a profile refusal carries the sentence", async () => {
    api.answer(422, { detail: "E-mail inválido." });

    await expect(updateProfile({ email: "x" })).rejects.toMatchObject({
      message: "E-mail inválido.",
    });
  });

  it("changes the password with the API's names", async () => {
    api.answer(200, { ok: true });

    await changePassword({ currentPassword: "velha123", newPassword: "nova12345" });

    expect(api.last()).toMatchObject({
      path: "/api/accounts/me/password",
      body: { current_password: "velha123", new_password: "nova12345" },
    });
  });

  it("a wrong current password is refused with the API's sentence", async () => {
    api.answer(400, { detail: "A senha atual não confere." });

    await expect(
      changePassword({ currentPassword: "errada", newPassword: "nova12345" }),
    ).rejects.toMatchObject({ status: 400, message: "A senha atual não confere." });
  });

  it("adds and removes a car and hands the updated account back", async () => {
    api.answer(201, accountOut);
    api.answer(200, { ...accountOut, cars: [] });

    const added = await addCar({ model: "Gol", color: "prata", plate: "ABC1D23" });
    expect(api.last()).toMatchObject({
      method: "POST",
      path: "/api/accounts/cars",
      body: { model: "Gol", color: "prata", plate: "ABC1D23" },
    });
    const removed = await removeCar("c1");
    expect(api.last()).toMatchObject({ method: "DELETE", path: "/api/accounts/cars/c1" });

    expect(added.cars).toHaveLength(1);
    expect(removed.cars).toEqual([]);
  });

  it("a refused car says why", async () => {
    api.answer(422, { detail: "Placa inválida." });
    await expect(addCar({ model: "Gol", color: "prata", plate: "?" })).rejects.toMatchObject({
      message: "Placa inválida.",
    });

    api.answer(404, {});
    await expect(removeCar("nope")).rejects.toMatchObject({
      status: 404,
      message: "Não foi possível concluir.",
    });
  });

  it("deletes the account, and says so when it could not", async () => {
    api.answerEmpty(204);
    await deleteAccount();
    expect(api.last()).toMatchObject({ method: "DELETE", path: "/api/accounts/me" });

    api.answer(500, {});
    await expect(deleteAccount()).rejects.toMatchObject({ message: "Não foi possível excluir." });
  });
});

describe("password recovery", () => {
  it("asks for a reset with the phone only", async () => {
    api.answer(200, { ok: true });

    await requestPasswordReset("+5561999990001");

    expect(api.last()).toMatchObject({
      path: "/api/accounts/password-reset",
      body: { phone: "+5561999990001" },
    });
  });

  it("a failed request says it could not ask", async () => {
    api.answer(503, {});

    await expect(requestPasswordReset("+55")).rejects.toMatchObject({
      message: "Não foi possível pedir.",
    });
  });

  it("confirms with the token and the new password", async () => {
    api.answer(200, { ok: true });

    await confirmPasswordReset("tok-1", "nova12345");

    expect(api.last()).toMatchObject({
      path: "/api/accounts/password-reset/confirm",
      body: { token: "tok-1", password: "nova12345" },
    });
  });

  it("an expired link is refused with the API's sentence", async () => {
    api.answer(400, { detail: "Link vencido. Peça outro." });

    await expect(confirmPasswordReset("old", "nova12345")).rejects.toMatchObject({
      message: "Link vencido. Peça outro.",
    });
  });
});
