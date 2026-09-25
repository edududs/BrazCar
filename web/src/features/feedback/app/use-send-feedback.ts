import { useMutation } from "@tanstack/react-query";

import { sendFeedback } from "../adapters/feedback-gateway";
import type { FeedbackData } from "../domain/feedback";

export interface SendFeedback {
  readonly send: (data: FeedbackData) => Promise<void>;
  readonly busy: boolean;
}

/** Headless: one opinion to the team. Nothing comes back but "received" (D-155). */
export function useSendFeedback(): SendFeedback {
  const mutation = useMutation({ mutationFn: (data: FeedbackData) => sendFeedback(data) });
  return { send: mutation.mutateAsync, busy: mutation.isPending };
}
