import { useId, useRef, type ReactNode } from "react";

import { Icon } from "./icon";

interface CheckboxFieldProps {
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  readonly children: ReactNode;
}

/**
 * A native checkbox in the design's box, with the whole line as its target. Text and box share the
 * line through a click handler and `aria-labelledby`, never a wrapping `<label>`: a `<label>` would
 * forward a click anywhere inside it, including a link nested in the text, to the box underneath,
 * so a link there could never be followed on its own. Nothing a caller nests in the text needs to
 * know about this: the handler itself steps aside for a click that started on a link or a button.
 */
export function CheckboxField({ checked, onChange, children }: CheckboxFieldProps) {
  const textId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <span className="flex min-h-11 items-start gap-3 text-secondary text-ink-2">
      <span className="relative mt-[-1px] grid size-[26px] shrink-0 place-items-center">
        <input
          ref={inputRef}
          type="checkbox"
          checked={checked}
          aria-labelledby={textId}
          onChange={(event) => {
            onChange(event.target.checked);
          }}
          className="peer size-full appearance-none rounded-lg border-2 border-line-strong bg-surface checked:border-brand checked:bg-brand"
        />
        <span className="pointer-events-none absolute text-on-brand opacity-0 peer-checked:opacity-100">
          <Icon name="check" size={16} />
        </span>
      </span>
      <span
        id={textId}
        className="cursor-pointer pt-0.5"
        onClick={(event) => {
          if (event.target instanceof Element && event.target.closest("a, button")) return;
          inputRef.current?.focus();
          onChange(!checked);
        }}
      >
        {children}
      </span>
    </span>
  );
}
