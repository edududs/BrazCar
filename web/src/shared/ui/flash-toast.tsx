import { Link } from "@tanstack/react-router";

import type { Flash } from "../domain/flash";
import { Icon } from "./icon";
import { Toast } from "./toast";

/** The line the previous screen left for this one, as a toast that goes away by itself. */
export function FlashToast({ flash }: { readonly flash: Flash }) {
  return (
    <Toast
      icon={<Icon name="check" size={16} />}
      action={
        flash.action === undefined ? undefined : (
          <Link
            to={flash.action.to}
            className="grid min-h-10 place-items-center rounded-[12px] px-3 text-secondary font-bold text-brand-on-ink"
          >
            {flash.action.label}
          </Link>
        )
      }
    >
      {flash.message}
    </Toast>
  );
}
