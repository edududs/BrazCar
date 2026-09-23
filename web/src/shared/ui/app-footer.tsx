interface AppFooterProps {
  readonly version: string;
}

/** The build's version at the bottom of every page, for support (D-105). */
export function AppFooter({ version }: AppFooterProps) {
  return (
    <footer className="mx-auto w-full max-w-md px-6 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-xs opacity-60">
      BrazCar {version}
    </footer>
  );
}
