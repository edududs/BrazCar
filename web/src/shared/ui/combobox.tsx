import { Combobox as BaseCombobox } from "@base-ui/react/combobox";
import type { ReactNode } from "react";

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
      <label className="flex flex-col gap-1 text-sm font-medium">
        {label}
        <BaseCombobox.Input
          placeholder={placeholder}
          onBlur={onInputBlur}
          className="min-h-11 rounded-lg border border-neutral-soft bg-surface px-3 text-base font-normal outline-none focus:border-accent"
        />
      </label>
      <BaseCombobox.Portal>
        <BaseCombobox.Positioner sideOffset={4} className="z-10 w-[var(--anchor-width)]">
          <BaseCombobox.Popup className="max-h-64 overflow-y-auto rounded-lg border border-neutral-soft bg-surface py-1 shadow-lg">
            {notice === undefined ? null : (
              <BaseCombobox.Status className="px-3 py-2 text-sm opacity-70">
                {notice}
              </BaseCombobox.Status>
            )}
            <BaseCombobox.List>
              {(item: T) => (
                <BaseCombobox.Item
                  key={itemKey(item)}
                  value={item}
                  className="flex min-h-11 items-center px-3 text-base data-highlighted:bg-accent-soft data-selected:font-semibold"
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
