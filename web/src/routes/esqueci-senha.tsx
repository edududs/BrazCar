import { createFileRoute } from "@tanstack/react-router";

import { PasswordResetRequestForm } from "@/features/accounts/ui/password-reset-request-form";
import { PageShell } from "@/shared/ui/page-shell";

export const Route = createFileRoute("/esqueci-senha")({ component: ForgotPasswordPage });

function ForgotPasswordPage() {
  return (
    <PageShell title="Esqueci a senha">
      <PasswordResetRequestForm />
    </PageShell>
  );
}
