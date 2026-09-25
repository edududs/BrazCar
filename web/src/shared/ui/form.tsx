import type { ReactNode, SyntheticEvent } from "react";

import { NoticeBar } from "./notice-bar";

interface FormProps {
  /** For a submit button that sits outside the form, on a fixed bar. */
  readonly id?: string;
  readonly onSubmit: () => void;
  readonly error?: string | null;
  readonly children: ReactNode;
}

/** A vertical form: fields, then a refusal when there is one, then whatever comes last. */
export function Form({ id, onSubmit, error = null, children }: FormProps) {
  return (
    <form
      id={id}
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
