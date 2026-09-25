/**
 * One line said on the next screen, carried in the navigation's own state: "Carona publicada.",
 * "Você saiu da conta.". It travels with the history entry, so a reload does not repeat it and a
 * back does not bring it again once shown.
 */
export interface Flash {
  readonly message: string;
  /** A short verb and where it leads, when there is something to do about it. */
  readonly action?: { readonly label: string; readonly to: "/entrar" | "/publicar" };
}

declare module "@tanstack/history" {
  interface HistoryState {
    flash?: Flash;
  }
}
