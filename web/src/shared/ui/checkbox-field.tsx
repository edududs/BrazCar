import type { ReactNode } from "react";

interface CheckboxFieldProps {
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  readonly children: ReactNode;
}

export function CheckboxField({ checked, onChange, children }: CheckboxFieldProps) {
  return (
    <label className="flex min-h-11 items-center gap-3 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => {
          onChange(event.target.checked);
        }}
        className="size-5 accent-accent"
      />
      <span>{children}</span>
    </label>
  );
}
