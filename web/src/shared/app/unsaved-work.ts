import { useEffect, useSyncExternalStore } from "react";

/**
 * Screens with typing in progress (the ride form). Whatever would reload the page, such as switching
 * to a new build, asks first while any is open (D-052).
 */
let open = 0;
const listeners = new Set<() => void>();

const setOpen = (next: number) => {
  open = next;
  for (const listener of listeners) listener();
};

const subscribe = (onChange: () => void) => {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
};

/** Marks the calling screen as holding unsaved work while it is mounted. */
export function useUnsavedWork(): void {
  useEffect(() => {
    setOpen(open + 1);
    return () => {
      setOpen(open - 1);
    };
  }, []);
}

export function useHasUnsavedWork(): boolean {
  return useSyncExternalStore(subscribe, () => open > 0);
}
