import type { ReactNode, SyntheticEvent } from "react";

import { NoticeBar } from "./notice-bar";

interface FormProps {
  readonly onSubmit: () => void;
  readonly error?: string | null;
  readonly children: ReactNode;
}

/** A vertical form: fields, then a refusal when there is one, then whatever comes last. */
export function Form({ onSubmit, error = null, children }: FormProps) {
  return (
    <form
      noValidate
      onSubmit={(event: SyntheticEvent<HTMLFormElement>) => {
        event.preventDefault();
        onSubmit();
      }}
      className="flex flex-col gap-5"
    >
      {children}
      {error === null ? null : (
        <NoticeBar tone="critical" role="alert">
          {error}
        </NoticeBar>
      )}
    </form>
  );
}
