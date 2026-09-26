import { beforeEach, describe, expect, it, vi } from "vitest";

import type { components } from "@/shared/adapters/api/schema";
import { AccountHeldError } from "@/shared/domain/account-held";

import { AccountRequestError } from "../domain/account";
import {
  addCar,
  changePassword,
  confirmEmail,
  confirmPasswordReset,
  deleteAccount,
  fetchCurrentAccount,
  giveInviteEmail,
  logIn,
  logOut,
  openInvite,
  openSignup,
  removeCar,
  requestEmailChange,
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
  email_confirmed: true,
  required_action: null,
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
      emailConfirmed: true,
      requiredAction: null,
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

  it("a held account carries the action it still owes (D-168)", async () => {
    api.answer(200, { ...accountOut, email_confirmed: false, required_action: "confirm_email" });

    const account = await fetchCurrentAccount(signal);

    expect(account).toMatchObject({ emailConfirmed: false, requiredAction: "confirm_email" });
  });
});

describe("opening the invite (D-166, D-167)", () => {
  it("shows the masked phone and prazo of an open invite", async () => {
    api.answer(200, {
      status: "open",
      phone_masked: "+5561*****0001",
      email_masked: null,
      expires_at: "2026-09-01T14:00:00-03:00",
    });

    const invite = await openInvite("tok-1", signal);

    expect(api.last()).toMatchObject({ method: "GET", path: "/api/accounts/invites/tok-1" });
    expect(invite).toEqual({
      status: "open",
      phoneMasked: "+5561*****0001",
      emailMasked: null,
      expiresAt: "2026-09-01T14:00:00-03:00",
    });
  });

  it("carries the masked e-mail once one is awaiting confirmation", async () => {
    api.answer(200, {
      status: "awaiting_email_confirmation",
      phone_masked: "+5561*****0001",
      email_masked: "a**@example.com",
      expires_at: "2026-09-01T14:00:00-03:00",
    });

    const invite = await openInvite("tok-1", signal);

    expect(invite.emailMasked).toBe("a**@example.com");
  });

  it("an unknown or spent invite is refused with the API's sentence", async () => {
    api.answer(410, { detail: "Convite vencido. Peça um convite novo." });

    await expect(openInvite("old", signal)).rejects.toMatchObject({
      status: 410,
      message: "Convite vencido. Peça um convite novo.",
    });
  });
});

describe("giving the invite's e-mail (D-166, D-167)", () => {
  it("sends the e-mail to the invite's own route", async () => {
    api.answer(202, { ok: true });

    await giveInviteEmail("tok-1", "ana@example.com");

    expect(api.last()).toMatchObject({
      method: "POST",
      path: "/api/accounts/invites/tok-1/email",
      body: { email: "ana@example.com" },
    });
  });

  it("an e-mail already with an account is refused with the API's sentence", async () => {
    api.answer(409, { detail: "Este e-mail já tem conta." });

    await expect(giveInviteEmail("tok-1", "outra@example.com")).rejects.toMatchObject({
      status: 409,
      message: "Este e-mail já tem conta.",
    });
  });

  it("too many sends (429) passes the API's own limit along, never one invented here", async () => {
    api.answer(429, { detail: "Muitos envios. Espere um pouco." });

    await expect(giveInviteEmail("tok-1", "ana@example.com")).rejects.toMatchObject({
      status: 429,
      message: "Muitos envios. Espere um pouco.",
    });
  });
});

describe("opening the e-mail link (D-167)", () => {
  it("shows the masked phone and the e-mail the invite carries", async () => {
    api.answer(200, {
      phone_masked: "+5561*****0001",
      email: "ana@example.com",
      email_expires_at: "2026-09-01T12:00:00-03:00",
    });

    const opened = await openSignup("tok-1", signal);

    expect(api.last()).toMatchObject({ method: "GET", path: "/api/accounts/signup/tok-1" });
    expect(opened).toEqual({
      phoneMasked: "+5561*****0001",
      email: "ana@example.com",
      emailExpiresAt: "2026-09-01T12:00:00-03:00",
    });
  });

  it("an unknown or spent link is refused with the API's sentence", async () => {
    api.answer(410, { detail: "Link vencido. Peça um convite novo." });

    await expect(openSignup("old", signal)).rejects.toMatchObject({
      status: 410,
      message: "Link vencido. Peça um convite novo.",
    });
  });
});

describe("signing up and in", () => {
  it("registers with only the e-mail link's token, no phone and no e-mail (D-167)", async () => {
    api.answer(201, accountOut);

    await signUp({
      emailToken: "tok-1",
      password: "segredo123",
      displayName: "Ana",
      acceptsTerms: true,
    });

    expect(api.last()).toMatchObject({
      method: "POST",
      path: "/api/accounts/register",
      credentials: "include",
      body: {
        email_token: "tok-1",
        password: "segredo123",
        display_name: "Ana",
        accepts_terms: true,
      },
    });
    expect(api.last().body).not.toHaveProperty("phone");
    expect(api.last().body).not.toHaveProperty("email");
  });

  it("a spent or lapsed link comes back as the API's sentence", async () => {
    api.answer(410, { detail: "Link vencido. Peça um convite novo." });

    const attempt = signUp({
      emailToken: "old",
      password: "segredo123",
      displayName: "Ana",
      acceptsTerms: true,
    });

    await expect(attempt).rejects.toBeInstanceOf(AccountRequestError);
    await expect(attempt).rejects.toMatchObject({
      status: 410,
      message: "Link vencido. Peça um convite novo.",
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

  it("a profile refusal carries the sentence", async () => {
    api.answer(422, { detail: "Nome social não pode ficar vazio." });

    await expect(updateProfile({ displayName: "" })).rejects.toMatchObject({
      message: "Nome social não pode ficar vazio.",
    });
  });

  it("requests the e-mail change, mailed to the new address (D-168)", async () => {
    api.answer(202, { ok: true });

    await requestEmailChange("ana-nova@example.com");

    expect(api.last()).toMatchObject({
      method: "POST",
      path: "/api/accounts/me/email",
      body: { email: "ana-nova@example.com" },
    });
  });

  it("an e-mail already taken is refused with the API's sentence", async () => {
    api.answer(409, { detail: "Este e-mail já tem conta." });

    await expect(requestEmailChange("outra@example.com")).rejects.toMatchObject({
      status: 409,
      message: "Este e-mail já tem conta.",
    });
  });

  it("confirms the e-mail change with the link's token and hands the account back", async () => {
    api.answer(200, { ...accountOut, email: "ana-nova@example.com" });

    const account = await confirmEmail("tok-2");

    expect(api.last()).toMatchObject({
      method: "POST",
      path: "/api/accounts/me/email/confirm",
      body: { token: "tok-2" },
    });
    expect(account.email).toBe("ana-nova@example.com");
  });

  it("an invalid or spent confirmation link is refused with the API's sentence", async () => {
    api.answer(400, { detail: "Link inválido ou vencido." });

    await expect(confirmEmail("old")).rejects.toMatchObject({
      status: 400,
      message: "Link inválido ou vencido.",
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

  it("a held account's write comes back as an AccountHeldError, not a refusal (D-168)", async () => {
    api.answer(403, {
      detail: "confirme seu e-mail para continuar",
      required_action: "confirm_email",
    });

    const attempt = updateProfile({ displayName: "Ana Paula" });

    await expect(attempt).rejects.toBeInstanceOf(AccountHeldError);
    await expect(attempt).rejects.not.toBeInstanceOf(AccountRequestError);
    await expect(attempt).rejects.toMatchObject({
      action: "confirm_email",
      message: "confirme seu e-mail para continuar",
    });
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
