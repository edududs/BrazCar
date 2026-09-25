import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";

import { useSession } from "@/features/accounts/app/use-session";
import { LoginForm } from "@/features/accounts/ui/login-form";
import { PageShell } from "@/shared/ui/page-shell";
import { inlineLinkClass } from "@/shared/ui/link-class";

export const Route = createFileRoute("/entrar")({ component: LoginPage });

function LoginPage() {
  const { logIn, busy } = useSession();
  const navigate = useNavigate();
  return (
    <PageShell title="Entrar">
      <LoginForm logIn={logIn} busy={busy} onDone={() => void navigate({ to: "/" })} />
      <p className="text-sm">
        <Link to="/esqueci-senha" className={inlineLinkClass}>
          Esqueci a senha
        </Link>
      </p>
      <p className="text-sm">
        Ainda não tem conta?{" "}
        <Link to="/cadastro" className={inlineLinkClass}>
          Criar conta
        </Link>
      </p>
    </PageShell>
  );
}
