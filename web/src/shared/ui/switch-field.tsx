import { Switch } from "@base-ui/react/switch";
import type { ReactNode } from "react";

interface SwitchFieldProps {
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  readonly children: ReactNode;
}

/** A switch with its words on the same line, the whole line a target, over Base UI (D-088). */
export function SwitchField({ checked, onChange, children }: SwitchFieldProps) {
  return (
    <label className="flex min-h-11 items-center justify-between gap-3 text-secondary text-ink-2 has-data-checked:text-ink">
      {children}
      <Switch.Root
        checked={checked}
        onCheckedChange={onChange}
        className="relative h-8 w-[52px] shrink-0 rounded-full bg-line-strong transition-colors duration-(--duration-state) data-checked:bg-brand"
      >
        <Switch.Thumb className="absolute top-[3px] left-[3px] size-[26px] rounded-full bg-[#ffffff] shadow-[0_2px_4px_rgb(0_0_0/0.2)] transition-[translate] duration-(--duration-state) ease-spring data-checked:translate-x-5" />
      </Switch.Root>
    </label>
  );
}
