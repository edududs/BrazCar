import type { ReactNode } from "react";

import { Icon } from "./icon";

interface CheckboxFieldProps {
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  readonly children: ReactNode;
}

/** A native checkbox in the design's box, with the whole line as its target. */
export function CheckboxField({ checked, onChange, children }: CheckboxFieldProps) {
  return (
    <label className="flex min-h-11 items-start gap-3 text-secondary text-ink-2">
      <span className="relative mt-[-1px] grid size-[26px] shrink-0 place-items-center">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => {
            onChange(event.target.checked);
          }}
          className="peer size-full appearance-none rounded-lg border-2 border-line-strong bg-surface checked:border-brand checked:bg-brand"
        />
        <span className="pointer-events-none absolute text-on-brand opacity-0 peer-checked:opacity-100">
          <Icon name="check" size={16} />
        </span>
      </span>
      <span className="pt-0.5">{children}</span>
    </label>
  );
}
