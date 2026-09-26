import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { landingAfterSignIn } from "@/features/accounts/app/landing-after-sign-in";
import { useSession } from "@/features/accounts/app/use-session";
import { LoginForm } from "@/features/accounts/ui/login-form";
import { isSafeReturnTo } from "@/shared/domain/safe-return-to";
import { BrandMark } from "@/shared/ui/brand-mark";
import { PageShell } from "@/shared/ui/page-shell";

interface LoginSearch {
  /** Where to go back to once signed in, e.g. from `/confirmar-email` without a session yet.
   * Optional, so every other `<Link to="/entrar">` keeps working without it. `null`/absent
   * unless it is an internal path (`isSafeReturnTo`): never an open redirect. */
  readonly returnTo?: string | null;
}

export const Route = createFileRoute("/entrar")({
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    returnTo:
      typeof search.returnTo === "string" && isSafeReturnTo(search.returnTo)
        ? search.returnTo
        : null,
  }),
  component: LoginPage,
});

/** Little text, each field explaining itself (S12). */
function LoginPage() {
  const { logIn, busy } = useSession();
  const { returnTo = null } = Route.useSearch();
  const navigate = useNavigate();
  return (
    <PageShell
      title="Entrar"
      back={{ to: "/", icon: "back", label: "Voltar ao mural" }}
      lead={<BrandMark size={48} />}
      intro="Com o celular e a senha da sua conta."
    >
      <LoginForm
        logIn={logIn}
        busy={busy}
        onDone={(account) => {
          const landing = landingAfterSignIn(account, returnTo);
          void (landing.kind === "return"
            ? navigate({ href: landing.href })
            : navigate({ to: landing.to }));
        }}
      />
    </PageShell>
  );
}
