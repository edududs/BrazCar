import { useMutation } from "@tanstack/react-query";

import { changePassword } from "../adapters/accounts-gateway";
import type { ChangePasswordData } from "../domain/account";

/**
 * Headless: change the password of the signed-in account. Independent of the session query,
 * because a changed password does not change what `AccountOut` shows (D-139).
 */
export interface ChangePasswordActions {
  readonly changePassword: (data: ChangePasswordData) => Promise<void>;
  readonly busy: boolean;
}

export function useChangePassword(): ChangePasswordActions {
  const mutation = useMutation({ mutationFn: changePassword });
  return { changePassword: mutation.mutateAsync, busy: mutation.isPending };
}
