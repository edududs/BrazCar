import { Combobox as BaseCombobox } from "@base-ui/react/combobox";
import type { ReactNode } from "react";

import { Box, FieldFrame, controlClass } from "./field";

/**
 * Searchable single choice over Base UI (D-057, D-088). Matching is not done here: the caller
 * hands in the items already filtered for `inputValue`, so the API or a hook owns the rule.
 */
export interface ComboboxProps<T> {
  readonly label: string;
  readonly placeholder?: string;
  readonly items: readonly T[];
  readonly itemKey: (item: T) => string;
  readonly itemLabel: (item: T) => string;
  readonly value: T | null;
  readonly onValueChange: (value: T | null) => void;
  readonly inputValue: string;
  readonly onInputValueChange: (inputValue: string) => void;
  /** Fired when the input loses focus, for a caller that commits typed text on blur. */
  readonly onInputBlur?: () => void;
  /** Shown inside the list instead of items: loading, failure, "nothing found". */
  readonly notice?: ReactNode;
}

export function Combobox<T>({
  label,
  placeholder,
  items,
  itemKey,
  itemLabel,
  value,
  onValueChange,
  inputValue,
  onInputValueChange,
  onInputBlur,
  notice,
}: ComboboxProps<T>) {
  return (
    <BaseCombobox.Root
      items={items}
      itemToStringLabel={itemLabel}
      isItemEqualToValue={(a, b) => itemKey(a) === itemKey(b)}
      filter={null}
      value={value}
      onValueChange={onValueChange}
      inputValue={inputValue}
      onInputValueChange={onInputValueChange}
    >
      <FieldFrame label={label}>
        {(control) => (
          <Box>
            <BaseCombobox.Input
              {...control}
              placeholder={placeholder}
              onBlur={onInputBlur}
              className={`${controlClass} h-[52px]`}
            />
          </Box>
        )}
      </FieldFrame>
      <BaseCombobox.Portal>
        <BaseCombobox.Positioner sideOffset={6} className="z-10 w-[var(--anchor-width)]">
          <BaseCombobox.Popup className="flex max-h-72 flex-col overflow-y-auto rounded-[18px] border border-line bg-surface p-1.5 shadow-3">
            {notice === undefined ? null : (
              <BaseCombobox.Status className="px-3 py-2.5 text-secondary text-ink-2">
                {notice}
              </BaseCombobox.Status>
            )}
            <BaseCombobox.List>
              {(item: T) => (
                <BaseCombobox.Item
                  key={itemKey(item)}
                  value={item}
                  className="flex min-h-[50px] items-center rounded-[12px] px-3 text-body text-ink data-highlighted:bg-brand-soft data-highlighted:text-brand-ink data-selected:font-bold"
                >
                  {itemLabel(item)}
                </BaseCombobox.Item>
              )}
            </BaseCombobox.List>
          </BaseCombobox.Popup>
        </BaseCombobox.Positioner>
      </BaseCombobox.Portal>
    </BaseCombobox.Root>
  );
}
