import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";

import { useSession } from "@/features/accounts/app/use-session";
import { LoginForm } from "@/features/accounts/ui/login-form";
import { PageShell } from "@/shared/ui/page-shell";

export const Route = createFileRoute("/entrar")({ component: LoginPage });

function LoginPage() {
  const { logIn, busy } = useSession();
  const navigate = useNavigate();
  return (
    <PageShell title="Entrar">
      <LoginForm logIn={logIn} busy={busy} onDone={() => void navigate({ to: "/" })} />
      <p className="text-sm">
        <Link to="/esqueci-senha" className="underline">
          Esqueci a senha
        </Link>
      </p>
      <p className="text-sm">
        Ainda não tem conta?{" "}
        <Link to="/cadastro" className="underline">
          Criar conta
        </Link>
      </p>
    </PageShell>
  );
}
