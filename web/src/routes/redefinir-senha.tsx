import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";

import { PasswordResetForm } from "@/features/accounts/ui/password-reset-form";
import { PageShell } from "@/shared/ui/page-shell";

interface ResetSearch {
  readonly token: string;
}

export const Route = createFileRoute("/redefinir-senha")({
  validateSearch: (search: Record<string, unknown>): ResetSearch => ({
    token: typeof search.token === "string" ? search.token : "",
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();
  return (
    <PageShell title="Redefinir senha">
      {token === "" ? (
        <p className="text-sm">
          Este link está incompleto.{" "}
          <Link to="/esqueci-senha" className="underline">
            Pedir outro
          </Link>
        </p>
      ) : (
        <PasswordResetForm token={token} onDone={() => void navigate({ to: "/entrar" })} />
      )}
    </PageShell>
  );
}
