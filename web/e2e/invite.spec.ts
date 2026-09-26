import { latestLinkTo } from "./support/mail";
import { expect, test } from "./support/fixtures";

/**
 * O convite (D-159, D-166, D-167) e a conta retida por e-mail não confirmado (D-160, D-168), de
 * ponta a ponta: o link é lido de verdade do arquivo que o backend da suíte grava
 * (`playwright.config.ts`, `support/mail.ts`), nunca do token que a semente já conhece.
 */

test("convite completo: outro e-mail, o link do arquivo e o cadastro", async ({
  page,
  demo,
  sparePhone,
  uniqueEmail,
  snap,
}) => {
  // A sexta jornada é a única reservada ao convite inteiro (dataset.py, SUITE_JOURNEYS).
  const invite = demo.suiteInviteAt(sparePhone(5));
  const email = uniqueEmail("convite");
  const password = "uma-senha-de-demonstracao";

  // A semente já deu um e-mail a este convite, então ele abre direto em "Confirme seu e-mail"
  // (D-166), com o endereço da semente mascarado — nenhum dos dois serve a este teste.
  await page.goto(`/convite?token=${invite.inviteToken}`);
  await expect(
    page.getByRole("heading", { name: "Confirme seu e-mail", exact: true }),
  ).toBeVisible();
  await snap(page, "invite/awaiting");

  await page.getByRole("button", { name: "Usar outro e-mail", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Seu convite", exact: true })).toBeVisible();
  await page.getByLabel("E-mail").fill(email);
  await snap(page, "invite/another-email");
  await page.getByRole("button", { name: "Receber o link", exact: true }).click();

  await expect(
    page.getByRole("heading", { name: "Confirme seu e-mail", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();
  await snap(page, "invite/sent");

  const link = await latestLinkTo(email, "/cadastro");
  await page.goto(link);

  await expect(
    page.getByRole("heading", { name: "Criar conta", exact: true, level: 1 }),
  ).toBeVisible();
  await expect(page.getByLabel("E-mail")).toHaveValue(email);
  await page.getByLabel("Nome").fill("Convite Completo");
  await page.getByLabel(/^Senha/).fill(password);
  await page.getByLabel("Li e aceito os termos").check();
  await page.getByRole("button", { name: "Criar conta", exact: true }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("link", { name: "Conta", exact: true })).toBeVisible();

  await page.goto("/conta");
  await expect(page.getByText(email)).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Falta confirmar seu e-mail", exact: true }),
  ).toHaveCount(0);
  await snap(page, "account/from-invite");
});

test("conta antiga: troca o e-mail, sai, entra pelo link e confirma", async ({
  page,
  demo,
  sparePhone,
  uniqueEmail,
  snap,
}) => {
  // As contas antigas da suíte não têm jornada própria (dataset.py): o mesmo índice de
  // `sparePhone(0)` indexa `suiteLegacyPhoneAt`, um array separado do de `suiteInviteAt`.
  const phone = demo.suiteLegacyPhoneAt(sparePhone(0));
  // A senha é a mesma constante de toda a semente (docs/runbooks/screens.md); esta conta não
  // nasceu de um cadastro deste teste, então não há convite de onde tirá-la.
  const password = demo.account("driver_no_car").password;
  const email = uniqueEmail("retido");

  await page.goto("/entrar");
  await page.getByLabel("Celular").fill(phone);
  await page.getByLabel(/^Senha/).fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);

  // O portão fica em cada rota que exige escrita (D-168), não no mural: "/conta" é onde a conta
  // retida aparece.
  await page.goto("/conta");
  await expect(
    page.getByRole("heading", { name: "Falta confirmar seu e-mail", exact: true }),
  ).toBeVisible();
  await snap(page, "account/held");

  await page.getByLabel("E-mail").fill(email);
  await page.getByRole("button", { name: "Receber o link", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Confirme seu e-mail", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();
  await snap(page, "account/held-email-sent");

  await page.getByRole("button", { name: "Sair da conta", exact: true }).click();
  await expect(page.getByText("Você saiu da conta.")).toBeVisible();

  const link = await latestLinkTo(email, "/confirmar-email");
  await page.goto(link);

  // Sem sessão, o link de confirmação manda entrar primeiro e guarda para onde voltar (D-168).
  await expect(page).toHaveURL(/\/entrar\?returnTo=/);
  await expect(page.getByRole("heading", { name: "Entrar", exact: true, level: 1 })).toBeVisible();

  await page.getByLabel("Celular").fill(phone);
  await page.getByLabel(/^Senha/).fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();

  await expect(page).toHaveURL(/\/conta$/);
  await expect(page.getByText("E-mail confirmado.")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Falta confirmar seu e-mail", exact: true }),
  ).toHaveCount(0);
  await snap(page, "account/confirmed");

  await page.goto("/publicar");
  await expect(
    page.getByRole("heading", { name: "Falta confirmar seu e-mail", exact: true }),
  ).toHaveCount(0);
});

test("link de confirmação inválido pede outro pela conta", async ({ page, signIn, snap }) => {
  await signIn(page, "driver_one_car");
  await page.goto("/confirmar-email?token=nao-serve");

  await expect(
    page.getByRole("heading", { name: "Link inválido ou vencido", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Pedir outro link", exact: true })).toBeVisible();
  await snap(page, "confirm-email/refused");
});

test("convite inválido não mostra formulário nenhum", async ({ page, snap }) => {
  await page.goto("/convite?token=nao-serve");

  await expect(
    page.getByRole("heading", { name: "Convite indisponível", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("E-mail")).toHaveCount(0);
  await snap(page, "invite/refused");
});
