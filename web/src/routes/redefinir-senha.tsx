import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";

import { PasswordResetForm } from "@/features/accounts/ui/password-reset-form";
import { Icon } from "@/shared/ui/icon";
import { NoticeScreen } from "@/shared/ui/notice-screen";
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
  if (token === "") {
    // Without the code the screen asks for another link instead of showing a technical error (S13).
    return (
      <NoticeScreen
        title="Este link está incompleto"
        glyph={<Icon name="link" size={32} />}
        glyphTone="critical"
        action={
          <Link
            to="/esqueci-senha"
            className="inline-flex min-h-target w-full items-center justify-center rounded-button bg-brand px-5 text-body font-semibold text-on-brand"
          >
            Pedir outro link
          </Link>
        }
      >
        Ele pode ter sido cortado ao copiar. Peça um link novo; ele chega no e-mail da conta.
      </NoticeScreen>
    );
  }
  return (
    <PageShell
      title="Redefinir senha"
      back={{ to: "/entrar", icon: "back", label: "Voltar" }}
      intro="Crie a nova senha da sua conta."
    >
      <PasswordResetForm token={token} onDone={() => void navigate({ to: "/entrar" })} />
    </PageShell>
  );
}
