import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { useOpenSignup } from "@/features/accounts/app/use-open-signup";
import { useSession } from "@/features/accounts/app/use-session";
import { SignupForm } from "@/features/accounts/ui/signup-form";
import { Icon } from "@/shared/ui/icon";
import { NoticeScreen } from "@/shared/ui/notice-screen";
import { PageShell } from "@/shared/ui/page-shell";

interface SignupSearch {
  readonly token: string;
}

export const Route = createFileRoute("/cadastro")({
  validateSearch: (search: Record<string, unknown>): SignupSearch => ({
    token: typeof search.token === "string" ? search.token : "",
  }),
  component: SignupPage,
});

/**
 * Only the e-mail link's page opens a form: signing up is invite-only (D-167). Without a token,
 * or with one the API no longer serves, the screen says so and shows nothing to fill in.
 */
function SignupPage() {
  const { token } = Route.useSearch();
  const { signup, status, reason } = useOpenSignup(token);
  const { signUp, busy } = useSession();
  const navigate = useNavigate();

  if (status === "loading") {
    return (
      <PageShell title="Criar conta" back={{ to: "/entrar", icon: "back", label: "Voltar" }}>
        <p className="text-secondary text-ink-2">Verificando o link…</p>
      </PageShell>
    );
  }

  if (status === "refused" || signup === null) {
    return (
      <NoticeScreen title="Só por convite" glyph={<Icon name="lock" size={32} />}>
        {reason ?? "O cadastro no BrazCar é só por convite."}
      </NoticeScreen>
    );
  }

  return (
    <PageShell
      title="Criar conta"
      back={{ to: "/entrar", icon: "back", label: "Voltar" }}
      intro="Para pedir contato e publicar caronas."
    >
      <SignupForm
        signup={signup}
        signUp={(data) => signUp({ ...data, emailToken: token })}
        busy={busy}
        onDone={() => void navigate({ to: "/" })}
      />
    </PageShell>
  );
}
