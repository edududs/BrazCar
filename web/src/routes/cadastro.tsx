import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { useSession } from "@/features/accounts/app/use-session";
import { SignupForm } from "@/features/accounts/ui/signup-form";
import { PageShell } from "@/shared/ui/page-shell";

export const Route = createFileRoute("/cadastro")({ component: SignupPage });

/** Four fields and the terms; every hint says what the data is for (S12). */
function SignupPage() {
  const { signUp, busy } = useSession();
  const navigate = useNavigate();
  return (
    <PageShell
      title="Criar conta"
      back={{ to: "/entrar", icon: "back", label: "Voltar" }}
      intro="Para pedir contato e publicar caronas."
    >
      <SignupForm signUp={signUp} busy={busy} onDone={() => void navigate({ to: "/" })} />
    </PageShell>
  );
}
