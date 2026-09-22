import { RideRequestError } from "../domain/ride";

/** The message a screen shows for a failed action. Unknown failures get one generic line. */
export function reasonOf(reason: unknown): string {
  return reason instanceof RideRequestError
    ? reason.message
    : "Sem resposta do serviço. Tente de novo.";
}
