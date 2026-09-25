import { type ReactNode, useState } from "react";

import { Icon } from "./icon";
import { TextField } from "./text-field";

interface PasswordFieldProps {
  readonly label?: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly autoComplete: "current-password" | "new-password";
  readonly placeholder?: string | undefined;
  readonly hint?: string | undefined;
  readonly error?: string | null;
  /** Something beside the label, like "Esqueci a senha". */
  readonly labelAside?: ReactNode;
}

/** A password with a button that shows it: people who see it mistype less (S12). */
export function PasswordField({
  label = "Senha",
  value,
  onChange,
  autoComplete,
  placeholder,
  hint,
  error = null,
  labelAside,
}: PasswordFieldProps) {
  const [shown, setShown] = useState(false);
  return (
    <TextField
      label={label}
      labelAside={labelAside}
      value={value}
      onChange={onChange}
      type={shown ? "text" : "password"}
      autoComplete={autoComplete}
      {...(placeholder === undefined ? {} : { placeholder })}
      hint={hint}
      error={error}
      required
      suffix={
        <button
          type="button"
          aria-label={shown ? "Ocultar senha" : "Mostrar senha"}
          aria-pressed={shown}
          onClick={() => {
            setShown((current) => !current);
          }}
          className="-mr-2.5 grid size-11 place-items-center rounded-full text-ink"
        >
          <Icon name="eye" />
        </button>
      }
    />
  );
}
