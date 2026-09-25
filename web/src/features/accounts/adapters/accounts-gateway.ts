import { apiClient } from "@/shared/adapters/api/client";
import type { components } from "@/shared/adapters/api/schema";

import {
  type Account,
  AccountRequestError,
  type CarData,
  type ChangePasswordData,
  type LoginData,
  type ProfileChanges,
  type SignupData,
} from "../domain/account";

type AccountOut = components["schemas"]["AccountOut"];
type ProfileIn = components["schemas"]["ProfileIn"];

function toAccount(out: AccountOut): Account {
  return {
    id: out.id,
    phone: out.phone,
    phoneDisplay: out.phone_display,
    displayName: out.display_name,
    email: out.email ?? null,
    cars: out.cars,
    canDrive: out.can_drive,
  };
}

function detailOf(error: unknown): string | null {
  if (typeof error === "object" && error !== null && "detail" in error) {
    const { detail } = error;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) return "Confira os dados informados.";
  }
  return null;
}

function refused(status: number, error: unknown): AccountRequestError {
  return new AccountRequestError(status, detailOf(error) ?? "Não foi possível concluir.");
}

/** `null` when there is no session; the API answers 401 and that is not an error here. */
export async function fetchCurrentAccount(signal: AbortSignal): Promise<Account | null> {
  const { data, response } = await apiClient.GET("/api/accounts/me", { signal });
  if (data !== undefined) return toAccount(data);
  if (response.status === 401) return null;
  throw new AccountRequestError(response.status, "Não foi possível verificar a sessão.");
}

export async function signUp(input: SignupData): Promise<Account> {
  const { data, error, response } = await apiClient.POST("/api/accounts/register", {
    body: {
      phone: input.phone,
      password: input.password,
      display_name: input.displayName,
      email: input.email.trim() === "" ? null : input.email,
      accepts_terms: input.acceptsTerms,
    },
  });
  if (data === undefined) throw refused(response.status, error);
  return toAccount(data);
}

export async function logIn(input: LoginData): Promise<Account> {
  const { data, error, response } = await apiClient.POST("/api/accounts/login", { body: input });
  if (data === undefined) throw refused(response.status, error);
  return toAccount(data);
}

export async function logOut(): Promise<void> {
  const { response } = await apiClient.POST("/api/accounts/logout");
  if (!response.ok) throw new AccountRequestError(response.status, "Não foi possível sair.");
}

export async function updateProfile(changes: ProfileChanges): Promise<Account> {
  const body: ProfileIn = {};
  if (changes.displayName !== undefined) body.display_name = changes.displayName;
  if (changes.email !== undefined) body.email = changes.email; // empty clears it (D-139)
  const { data, error, response } = await apiClient.PATCH("/api/accounts/me", { body });
  if (data === undefined) throw refused(response.status, error);
  return toAccount(data);
}

export async function changePassword(input: ChangePasswordData): Promise<void> {
  const { error, response } = await apiClient.POST("/api/accounts/me/password", {
    body: { current_password: input.currentPassword, new_password: input.newPassword },
  });
  if (!response.ok) throw refused(response.status, error);
}

export async function addCar(input: CarData): Promise<Account> {
  const { data, error, response } = await apiClient.POST("/api/accounts/cars", { body: input });
  if (data === undefined) throw refused(response.status, error);
  return toAccount(data);
}

export async function removeCar(carId: string): Promise<Account> {
  const { data, error, response } = await apiClient.DELETE("/api/accounts/cars/{car_id}", {
    params: { path: { car_id: carId } },
  });
  if (data === undefined) throw refused(response.status, error);
  return toAccount(data);
}

export async function requestPasswordReset(phone: string): Promise<void> {
  const { response } = await apiClient.POST("/api/accounts/password-reset", { body: { phone } });
  if (!response.ok) throw new AccountRequestError(response.status, "Não foi possível pedir.");
}

export async function confirmPasswordReset(token: string, password: string): Promise<void> {
  const { error, response } = await apiClient.POST("/api/accounts/password-reset/confirm", {
    body: { token, password },
  });
  if (!response.ok) throw refused(response.status, error);
}

export async function deleteAccount(): Promise<void> {
  const { response } = await apiClient.DELETE("/api/accounts/me");
  if (!response.ok) throw new AccountRequestError(response.status, "Não foi possível excluir.");
}
