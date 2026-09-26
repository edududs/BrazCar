import { createFileRoute } from "@tanstack/react-router";

import { useInvite } from "@/features/accounts/app/use-invite";
import { InviteEmailForm } from "@/features/accounts/ui/invite-email-form";
import { InviteSentScreen } from "@/features/accounts/ui/invite-sent-screen";
import { Icon } from "@/shared/ui/icon";
import { NoticeScreen } from "@/shared/ui/notice-screen";
import { PageShell } from "@/shared/ui/page-shell";

interface InviteSearch {
  readonly token: string;
}

export const Route = createFileRoute("/convite")({
  validateSearch: (search: Record<string, unknown>): InviteSearch => ({
    token: typeof search.token === "string" ? search.token : "",
  }),
  component: InvitePage,
});

/**
 * Opens the invite the owner sent by hand (D-159, D-166): the phone and prazo it carries, the
 * step of giving an e-mail, and the confirmation once it is sent. There is no public way to ask
 * for one, so a link that does not serve just says why, with no way to try another.
 */
function InvitePage() {
  const { token } = Route.useSearch();
  const invite = useInvite(token);

  if (invite.status === "loading") {
    return (
      <PageShell title="Seu convite" back={{ to: "/entrar", icon: "back", label: "Voltar" }}>
        <p className="text-secondary text-ink-2">Verificando o convite…</p>
      </PageShell>
    );
  }

  if (invite.status === "refused") {
    return (
      <NoticeScreen title="Convite indisponível" glyph={<Icon name="lock" size={32} />}>
        {invite.reason ?? "Este link de convite não é válido."} Convites são enviados só por quem
        cuida do BrazCar.
      </NoticeScreen>
    );
  }

  if (invite.status === "sent") {
    return (
      <InviteSentScreen
        email={invite.email}
        canResend={invite.canResend}
        sending={invite.sending}
        resend={invite.resend}
        useAnotherEmail={invite.useAnotherEmail}
      />
    );
  }

  return (
    <PageShell title="Seu convite" back={{ to: "/entrar", icon: "back", label: "Voltar" }}>
      <InviteEmailForm
        invite={invite.invite}
        sending={invite.sending}
        giveEmail={invite.giveEmail}
      />
    </PageShell>
  );
}
