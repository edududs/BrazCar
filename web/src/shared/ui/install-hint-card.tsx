import { BrandMark } from "./brand-mark";
import { Icon } from "./icon";
import { InstallSteps } from "./install-steps";

interface InstallHintCardProps {
  readonly onDismiss: () => void;
}

/**
 * How to add the app to the home screen, on an iPhone in a browser tab (D-106): a card that
 * floats above the tab bar, with the two icons the person will look for in Safari.
 */
export function InstallHintCard({ onDismiss }: InstallHintCardProps) {
  return (
    <aside
      aria-label="Use como app"
      className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-30 mx-auto flex max-w-md items-start gap-3 rounded-card border border-line bg-surface py-3.5 pr-3 pl-3.5 shadow-2"
    >
      <BrandMark size={48} />
      <div className="flex-1">
        <p className="text-base font-bold text-ink">Use como app</p>
        <p className="mt-0.5 text-sm leading-[1.45] text-ink-2">
          <InstallSteps />
        </p>
      </div>
      <button
        type="button"
        aria-label="Agora não"
        onClick={onDismiss}
        className="-mt-2 -mr-1 grid size-11 shrink-0 place-items-center rounded-full text-ink"
      >
        <Icon name="x" />
      </button>
    </aside>
  );
}
