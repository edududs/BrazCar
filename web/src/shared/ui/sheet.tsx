import { Drawer } from "@base-ui/react/drawer";
import type { ReactNode } from "react";

import { Icon } from "./icon";

interface SheetProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly title: string;
  readonly description?: string;
  readonly children: ReactNode;
}

/**
 * A sheet that rises from the bottom, over Base UI's drawer (D-088): focus, escape, the backdrop
 * and the swipe down to dismiss are theirs. The skin is the boards': 30 px corners, a grab
 * handle, the title in display type and a close button at the right.
 */
export function Sheet({ open, onOpenChange, title, description, children }: SheetProps) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} swipeDirection="down">
      <Drawer.Portal>
        <Drawer.Backdrop className="fixed inset-0 min-h-dvh bg-scrim opacity-[calc(1-var(--drawer-swipe-progress))] transition-opacity duration-(--duration-enter) ease-out data-ending-style:opacity-0 data-starting-style:opacity-0 data-swiping:duration-0 supports-[-webkit-touch-callout:none]:absolute" />
        <Drawer.Viewport className="fixed inset-0 z-40 flex items-end justify-center">
          <Drawer.Popup className="flex max-h-[92dvh] w-full max-w-md flex-col rounded-t-sheet bg-surface px-gutter pt-2.5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] text-ink shadow-3 outline-none transition-transform duration-(--duration-enter) ease-out [transform:translateY(var(--drawer-swipe-movement-y))] data-ending-style:[transform:translateY(100%)] data-starting-style:[transform:translateY(100%)] data-swiping:select-none motion-reduce:transition-opacity motion-reduce:data-ending-style:opacity-0 motion-reduce:data-ending-style:[transform:none] motion-reduce:data-starting-style:opacity-0 motion-reduce:data-starting-style:[transform:none]">
            <span
              aria-hidden
              className="mb-1 h-[5px] w-10 self-center rounded-[3px] bg-line-strong"
            />
            <Drawer.Content className="flex flex-col gap-4 overflow-y-auto overscroll-contain pt-2">
              <header className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-1.5">
                  <Drawer.Title className="font-display text-heading font-bold text-balance">
                    {title}
                  </Drawer.Title>
                  {description === undefined ? null : (
                    <Drawer.Description className="text-secondary text-ink-2">
                      {description}
                    </Drawer.Description>
                  )}
                </div>
                <Drawer.Close
                  aria-label="Fechar"
                  className="grid size-11 shrink-0 place-items-center rounded-full bg-surface-2 text-ink"
                >
                  <Icon name="x" />
                </Drawer.Close>
              </header>
              {children}
            </Drawer.Content>
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
