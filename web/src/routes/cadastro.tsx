import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";

import { useSession } from "@/features/accounts/app/use-session";
import { SignupForm } from "@/features/accounts/ui/signup-form";
import { PageShell } from "@/shared/ui/page-shell";

export const Route = createFileRoute("/cadastro")({ component: SignupPage });

function SignupPage() {
  const { signUp, busy } = useSession();
  const navigate = useNavigate();
  return (
    <PageShell title="Criar conta">
      <SignupForm signUp={signUp} busy={busy} onDone={() => void navigate({ to: "/" })} />
      <p className="text-sm">
        Já tem conta?{" "}
        <Link to="/entrar" className="underline">
          Entrar
        </Link>
      </p>
    </PageShell>
  );
}
