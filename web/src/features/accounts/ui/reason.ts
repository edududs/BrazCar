import { AccountHeldError } from "@/shared/domain/account-held";

import { AccountRequestError } from "../domain/account";

/** The message a screen shows for a failed action. Unknown failures get one generic line. */
export function reasonOf(reason: unknown): string {
  if (reason instanceof AccountHeldError || reason instanceof AccountRequestError) {
    return reason.message;
  }
  return "Sem resposta do serviço. Tente de novo.";
}
