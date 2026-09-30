import { AccountHeldError } from "@/shared/domain/account-held";

import { AccountRequestError } from "../domain/account";

const SERVER_FAILURE = "Falha no servidor. Tente de novo em instantes.";
const EMAIL_SERVER_FAILURE = "Falha no servidor ao enviar o e-mail. Tente de novo em instantes.";

/** Options for the screens whose action sends an e-mail: a failure there says so. */
interface ReasonOptions {
  readonly sendsEmail?: boolean;
}

/**
 * The message a screen shows for a failed action. A 4xx carries the API's own reason (limit,
 * expired, superseded, e-mail already taken); a 5xx gets a line of its own, never the gateway's
 * generic "Não foi possível concluir.".
 */
export function reasonOf(reason: unknown, { sendsEmail = false }: ReasonOptions = {}): string {
  if (reason instanceof AccountHeldError) return reason.message;
  if (reason instanceof AccountRequestError) {
    if (reason.status < 500) return reason.message;
    return sendsEmail ? EMAIL_SERVER_FAILURE : SERVER_FAILURE;
  }
  return "Sem resposta do serviço. Tente de novo.";
}
