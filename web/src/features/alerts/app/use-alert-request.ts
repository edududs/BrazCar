import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import type { DevicePush } from "@/shared/app/use-device-push";

import { createAlert } from "../adapters/alerts-gateway";
import type { AlertData } from "../domain/alert";
import { alertKeys } from "./keys";

export interface AlertRequest {
  /** Turns push on for the device, then creates the alert. */
  readonly submit: (data: AlertData) => void;
  readonly phase: "editing" | "created";
  /** The push prompt or the request is running. */
  readonly busy: boolean;
  /** What the API refused with; null when nothing failed. */
  readonly error: unknown;
  readonly reset: () => void;
}

interface AlertRequestOptions {
  readonly accountId: string;
  readonly push: Pick<DevicePush, "enable">;
}

/**
 * Headless: asks for the alert from the sheet. `enable` is called first and synchronously, as the
 * permission prompt only shows inside the tap (iOS). The alert is created whatever it answers,
 * since another device of the account may be the one to receive it.
 */
export function useAlertRequest({ accountId, push }: AlertRequestOptions): AlertRequest {
  const queryClient = useQueryClient();
  const [asking, setAsking] = useState(false);
  const mutation = useMutation({
    mutationFn: (data: AlertData) => createAlert(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: alertKeys.mine(accountId) });
    },
  });

  const submit = (data: AlertData): void => {
    const enabling = push.enable();
    setAsking(true);
    const send = () => {
      setAsking(false);
      mutation.mutate(data);
    };
    enabling.then(send, send);
  };

  return {
    submit,
    phase: mutation.isSuccess ? "created" : "editing",
    busy: asking || mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
  };
}
