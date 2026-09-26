import { Link, Navigate, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { useEmailConfirmation } from "@/features/accounts/app/use-email-confirmation";
import { useSession } from "@/features/accounts/app/use-session";
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

/**
 * Opens the e-mail's own link (D-168, D-167 mirrored for a change instead of a signup): with a
 * session, it confirms on its own; without one, it sends the person to sign in first and carries
 * the way back, since the token is meant for the account it was mailed to.
 */
function ConfirmEmailPage() {
  const { token } = Route.useSearch();
  const { session } = useSession();
  const { confirm } = useEmailConfirmation();
  const navigate = useNavigate();
  const [refused, setRefused] = useState(false);
  const attempted = useRef(false);
  const here = `/confirmar-email?token=${encodeURIComponent(token)}`;

  useEffect(() => {
    if (session.status !== "signed-in" || attempted.current) return;
    attempted.current = true;
    confirm(token).then(
      () => void navigate({ to: "/conta", state: { flash: { message: "E-mail confirmado." } } }),
      () => {
        setRefused(true);
      },
    );
  }, [session.status, token, confirm, navigate]);

  if (session.status === "anonymous") {
    return <Navigate to="/entrar" search={{ returnTo: here }} />;
  }

  if (refused) {
    return (
      <NoticeScreen
        title="Link inválido ou vencido"
        glyph={<Icon name="lock" size={32} />}
        glyphTone="critical"
        action={
          <Link
            to="/conta"
            className="inline-flex min-h-target w-full items-center justify-center rounded-button bg-brand px-5 text-body font-semibold text-on-brand"
          >
            Pedir outro link
          </Link>
        }
      >
        Peça outro link direto na sua conta.
      </NoticeScreen>
    );
  }

  return (
    <PageShell title="Confirmar e-mail">
      <p className="text-secondary text-ink-2">
        {session.status === "checking" ? "Verificando…" : "Confirmando…"}
      </p>
    </PageShell>
  );
}
