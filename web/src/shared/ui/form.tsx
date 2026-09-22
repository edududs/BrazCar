import type { ReactNode, SyntheticEvent } from "react";

interface FormProps {
  readonly onSubmit: () => void;
  readonly error?: string | null;
  readonly children: ReactNode;
}

/** A vertical form: fields, then an error line when there is one, then whatever comes last. */
export function Form({ onSubmit, error = null, children }: FormProps) {
  return (
    <form
      noValidate
      onSubmit={(event: SyntheticEvent<HTMLFormElement>) => {
        event.preventDefault();
        onSubmit();
      }}
      className="flex flex-col gap-4"
    >
      {children}
      {error === null ? null : (
        <p role="alert" className="rounded-lg bg-critical-soft px-3 py-2 text-sm text-critical">
          {error}
        </p>
      )}
    </form>
  );
}
