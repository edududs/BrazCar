import { Navigate, createFileRoute } from "@tanstack/react-router";

import { useConfirmEmailLink } from "@/features/accounts/app/use-confirm-email-link";
import { ActionLink } from "@/shared/ui/action-link";
import { Icon } from "@/shared/ui/icon";
import { NoticeScreen } from "@/shared/ui/notice-screen";
import { PageShell } from "@/shared/ui/page-shell";

interface ConfirmEmailSearch {
  readonly token: string;
}

export const Route = createFileRoute("/confirmar-email")({
  validateSearch: (search: Record<string, unknown>): ConfirmEmailSearch => ({
    token: typeof search.token === "string" ? search.token : "",
  }),
  component: ConfirmEmailPage,
});

/** Draws whichever state `useConfirmEmailLink` hands over; the flow itself lives in the hook. */
function ConfirmEmailPage() {
  const { token } = Route.useSearch();
  const view = useConfirmEmailLink(token);

  if (view.status === "needs-sign-in") {
    return <Navigate to="/entrar" search={{ returnTo: view.returnTo }} />;
  }

  if (view.status === "refused") {
    return (
      <NoticeScreen
        title="Link inválido ou vencido"
        glyph={<Icon name="lock" size={32} />}
        glyphTone="critical"
        action={
          <ActionLink to="/conta" emphasis="primary">
            Pedir outro link
          </ActionLink>
        }
      >
        Peça outro link direto na sua conta.
      </NoticeScreen>
    );
  }

  return (
    <PageShell title="Confirmar e-mail">
      <p className="text-secondary text-ink-2">
        {view.status === "checking" ? "Verificando…" : "Confirmando…"}
      </p>
    </PageShell>
  );
}
