import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";

import { useSession } from "@/features/accounts/app/use-session";
import { LoginForm } from "@/features/accounts/ui/login-form";
import { BrandMark } from "@/shared/ui/brand-mark";
import { inlineLinkClass } from "@/shared/ui/link-class";
import { PageShell } from "@/shared/ui/page-shell";

export const Route = createFileRoute("/entrar")({ component: LoginPage });

/** Little text, each field explaining itself (S12). */
function LoginPage() {
  const { logIn, busy } = useSession();
  const navigate = useNavigate();
  return (
    <PageShell
      title="Entrar"
      back={{ to: "/", icon: "back", label: "Voltar ao mural" }}
      lead={<BrandMark size={48} />}
      intro="Com o celular e a senha da sua conta."
    >
      <LoginForm logIn={logIn} busy={busy} onDone={() => void navigate({ to: "/" })} />
      <div className="border-t border-line-soft" />
      <p className="text-center text-secondary text-ink-2">
        Ainda não tem conta?{" "}
        <Link to="/cadastro" className={inlineLinkClass}>
          Criar conta
        </Link>
      </p>
    </PageShell>
  );
}
