import { createFileRoute } from "@tanstack/react-router";

import { PasswordResetRequestForm } from "@/features/accounts/ui/password-reset-request-form";
import { Icon } from "@/shared/ui/icon";
import { PageShell } from "@/shared/ui/page-shell";

export const Route = createFileRoute("/esqueci-senha")({ component: ForgotPasswordPage });

/** One field, the condition said first: the link goes to the account's e-mail (S13). */
function ForgotPasswordPage() {
  return (
    <PageShell
      title="Esqueci a senha"
      back={{ to: "/entrar", icon: "back", label: "Voltar" }}
      lead={
        <span className="grid size-[76px] place-items-center rounded-dialog bg-brand-soft text-brand-ink">
          <Icon name="key" size={32} />
        </span>
      }
      intro="Digite o celular da conta. Se ela tiver e-mail cadastrado, mandamos um link para criar outra senha."
    >
      <PasswordResetRequestForm />
    </PageShell>
  );
}
