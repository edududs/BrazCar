import { AccountHeldError } from "@/shared/domain/account-held";

import { RideRequestError } from "../domain/ride";

/** The message a screen shows for a failed action. Unknown failures get one generic line. */
export function reasonOf(reason: unknown): string {
  if (reason instanceof AccountHeldError || reason instanceof RideRequestError) {
    return reason.message;
  }
  return "Sem resposta do serviço. Tente de novo.";
}
