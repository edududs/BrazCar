import { useId, useRef } from "react";

import { Icon } from "./icon";

interface SearchFieldProps {
  /** The name assistive technology reads; the placeholder is what sighted people see. */
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly placeholder?: string;
}

/** The search box at the top of the board: an icon, the text, and a way to clear it. */
export function SearchField({ label, value, onChange, placeholder }: SearchFieldProps) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="flex min-h-target items-center gap-2.5 rounded-button border-[1.5px] border-line bg-surface pr-2 pl-4 text-ink-3 shadow-1 focus-within:border-brand focus-within:ring-4 focus-within:ring-ring">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Icon name="search" />
      <input
        ref={input}
        id={id}
        type="search"
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        placeholder={placeholder}
        enterKeyHint="search"
        className="h-[50px] min-w-0 flex-1 appearance-none bg-transparent text-body text-ink outline-none placeholder:text-ink-3 [&::-webkit-search-cancel-button]:hidden"
      />
      {value === "" ? null : (
        <button
          type="button"
          aria-label="Limpar busca"
          onClick={() => {
            onChange("");
            // Clearing is usually the start of another search: the keyboard stays up.
            input.current?.focus();
          }}
          className="grid size-10 shrink-0 place-items-center rounded-full text-ink"
        >
          <Icon name="x" />
        </button>
      )}
    </div>
  );
}
