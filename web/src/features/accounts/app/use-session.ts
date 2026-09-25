import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  addCar,
  deleteAccount,
  fetchCurrentAccount,
  logIn,
  logOut,
  removeCar,
  signUp,
  updateProfile,
} from "../adapters/accounts-gateway";
import type { Account, CarData, LoginData, ProfileChanges, SignupData } from "../domain/account";
import type { Session } from "../domain/session";

export const SESSION_KEY = ["session"] as const;

/** Headless session: who is signed in, and every action that changes that. */
export interface SessionActions {
  readonly session: Session;
  readonly signUp: (data: SignupData) => Promise<Account>;
  readonly logIn: (data: LoginData) => Promise<Account>;
  readonly logOut: () => Promise<void>;
  readonly updateProfile: (changes: ProfileChanges) => Promise<Account>;
  readonly addCar: (data: CarData) => Promise<Account>;
  readonly removeCar: (carId: string) => Promise<Account>;
  readonly deleteAccount: () => Promise<void>;
  /** The action in flight, if any; screens disable their buttons on it. */
  readonly busy: boolean;
}

export function useSession(): SessionActions {
  const queryClient = useQueryClient();
  const { data, status } = useQuery({
    queryKey: SESSION_KEY,
    queryFn: ({ signal }) => fetchCurrentAccount(signal),
    staleTime: 60_000,
    retry: false,
  });

  const remember = (account: Account | null) => {
    queryClient.setQueryData(SESSION_KEY, account);
  };
  const signUpMutation = useMutation({ mutationFn: signUp, onSuccess: remember });
  const logInMutation = useMutation({ mutationFn: logIn, onSuccess: remember });
  const logOutMutation = useMutation({
    mutationFn: logOut,
    onSuccess: () => {
      remember(null);
    },
  });
  const updateProfileMutation = useMutation({ mutationFn: updateProfile, onSuccess: remember });
  const addCarMutation = useMutation({ mutationFn: addCar, onSuccess: remember });
  const removeCarMutation = useMutation({ mutationFn: removeCar, onSuccess: remember });
  const deleteMutation = useMutation({
    mutationFn: deleteAccount,
    onSuccess: () => {
      remember(null);
    },
  });

  const session: Session =
    status === "pending"
      ? { status: "checking" }
      : data === null || data === undefined
        ? { status: "anonymous" }
        : { status: "signed-in", account: data };

  return {
    session,
    signUp: signUpMutation.mutateAsync,
    logIn: logInMutation.mutateAsync,
    logOut: logOutMutation.mutateAsync,
    updateProfile: updateProfileMutation.mutateAsync,
    addCar: addCarMutation.mutateAsync,
    removeCar: removeCarMutation.mutateAsync,
    deleteAccount: deleteMutation.mutateAsync,
    busy: [
      signUpMutation,
      logInMutation,
      logOutMutation,
      updateProfileMutation,
      addCarMutation,
      removeCarMutation,
      deleteMutation,
    ].some((mutation) => mutation.isPending),
  };
}
