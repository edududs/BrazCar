import type { ReactNode } from "react";

import { Icon, type IconName } from "./icon";

/** How to add the app to the home screen in Safari, with the two icons the person will look for. */
export function InstallSteps() {
  return (
    <>
      Toque em <Key icon="share">Compartilhar</Key> e depois em{" "}
      <Key icon="addhome">Adicionar à Tela de Início</Key>.
    </>
  );
}

function Key({ icon, children }: { readonly icon: IconName; readonly children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-[7px] bg-surface-2 px-1.5 py-px font-semibold whitespace-nowrap text-ink">
      <Icon name={icon} size={16} />
      {children}
    </span>
  );
}
