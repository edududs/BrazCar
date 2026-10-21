import type { Page } from "@playwright/test";

import { expect, openBoard, test } from "./support/fixtures";
import { apiOrigin, webOrigin } from "./support/origins";
import { localDayOf } from "./support/time";

/**
 * "Me avise": pedir o aviso a partir do mural, vê-lo na conta, bater no teto e o convite ao visitante.
 *
 * A API da suíte sobe sem chaves de push (503 em `/api/push/public-key`), então nenhuma jornada
 * depende de serviço de notificação: com a permissão concedida, o aparelho só diz que não está
 * disponível, e o aviso é criado do mesmo jeito.
 */

const PUSH_UNAVAILABLE = "As notificações não estão disponíveis no momento.";
const TEXT = "Incra 8";
const LIMIT = 5;
const TOMORROW_MINUTES = 24 * 60;

interface ListedAlert {
  readonly id: string;
}

/**
 * A permissão de notificação concedida, para o caminho ser o mesmo em toda máquina. O Chromium sem
 * tela segue respondendo "denied" em `Notification.permission` mesmo depois do `grantPermissions`,
 * então o estado é fixado também na página. Nenhum serviço de push é simulado: quem responde que
 * não há chave é a própria API da suíte.
 */
async function allowNotifications(page: Page): Promise<void> {
  await page.context().grantPermissions(["notifications"], { origin: webOrigin });
  await page.addInitScript(() => {
    Object.defineProperty(Notification, "permission", { get: () => "granted" });
  });
}

/** Os projetos rodam em sequência sobre o mesmo banco e um teste pode repetir: ninguém herda aviso. */
async function clearAlerts(page: Page): Promise<void> {
  const listed = await page.request.get(`${apiOrigin}/api/alerts`);
  expect(listed.ok(), await listed.text()).toBe(true);
  const { alerts } = (await listed.json()) as { alerts: ListedAlert[] };
  for (const alert of alerts) {
    const removed = await page.request.delete(`${apiOrigin}/api/alerts/${alert.id}`, {
      headers: { Origin: webOrigin },
    });
    expect(removed.ok(), await removed.text()).toBe(true);
  }
}

async function createAlertFor(page: Page, day: string, text: string): Promise<void> {
  const created = await page.request.post(`${apiOrigin}/api/alerts`, {
    headers: { Origin: webOrigin },
    data: { day, text },
  });
  expect(created.ok(), await created.text()).toBe(true);
}

test("criar aviso a partir do mural filtrado", async ({ page, demo, signIn, snap }) => {
  await signIn(page, "passenger");
  await allowNotifications(page);
  await clearAlerts(page);

  try {
    const tomorrow = localDayOf(demo.anchor, TOMORROW_MINUTES);
    await openBoard(page);
    await page.getByRole("button", { name: "Amanhã", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`day=${tomorrow}`));
    const search = page.getByRole("searchbox", { name: "Passa por", exact: true });
    // Com atraso entre as teclas: o campo do mural é controlado pela URL, e digitar mais rápido
    // que a navegação perde letras (ver o relatório da tarefa).
    await search.pressSequentially(TEXT, { delay: 120 });
    await expect(search).toHaveValue(TEXT);
    await expect(page).toHaveURL(/q=Incra/);
    await page.getByRole("button", { name: "A partir de", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "17:00", exact: true }).click();
    await page.getByRole("button", { name: "Mostrar caronas", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "A partir de 17:00", exact: true }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Me avise", exact: true }).click();
    const sheet = page.getByRole("dialog");
    await expect(sheet.getByRole("radio", { name: "Amanhã", exact: true })).toBeChecked();
    await expect(sheet.getByRole("textbox", { name: /^Passa por/ })).toHaveValue(TEXT);
    await expect(sheet.getByRole("switch", { name: "A partir de", exact: true })).toBeChecked();
    const from = sheet.getByRole("group", { name: "A partir de", exact: true });
    await expect(from.getByRole("textbox", { name: "Hora", exact: true })).toHaveValue("17");
    await expect(from.getByRole("textbox", { name: "Minutos", exact: true })).toHaveValue("00");
    await expect(sheet.getByRole("switch", { name: "Até", exact: true })).not.toBeChecked();
    await expect(sheet.getByRole("group", { name: "Até", exact: true })).toHaveCount(0);
    await snap(page, "alerts/sheet");

    await sheet.getByRole("button", { name: "Criar aviso", exact: true }).click();
    await expect(sheet.getByRole("heading", { name: "Aviso criado.", exact: true })).toBeVisible();
    await expect(sheet.getByText(PUSH_UNAVAILABLE, { exact: true })).toBeVisible();
    await snap(page, "alerts/created");

    await sheet.getByRole("button", { name: "Pronto", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await page.getByRole("link", { name: "Conta", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Meus avisos", exact: true })).toBeVisible();
    await expect(page.getByText("1 de 5", { exact: true })).toBeVisible();
    const summary = `Passa por ${TEXT} · a partir de 17:00`;
    const main = page.getByRole("main");
    await expect(main.getByText("Amanhã", { exact: true })).toBeVisible();
    await expect(main.getByText(summary, { exact: true })).toBeVisible();
    await snap(page, "account/alerts");

    await page
      .getByRole("button", { name: `Apagar aviso de Amanhã, ${summary}`, exact: true })
      .click();
    await expect(page.getByText("Nenhum aviso ativo.", { exact: true })).toBeVisible();
    await expect(page.getByText("0 de 5", { exact: true })).toBeVisible();
  } finally {
    await clearAlerts(page);
  }
});

test("o teto de 5 avisos", async ({ page, demo, signIn, snap }) => {
  await signIn(page, "passenger");
  await allowNotifications(page);
  await clearAlerts(page);

  try {
    const tomorrow = localDayOf(demo.anchor, TOMORROW_MINUTES);
    for (let index = 0; index < LIMIT; index += 1) {
      await createAlertFor(page, tomorrow, `Lugar ${String(index + 1)}`);
    }

    await openBoard(page);
    await page.getByRole("button", { name: "Me avise", exact: true }).click();
    const sheet = page.getByRole("dialog");
    // O mesmo dia dos cinco: o "hoje" do relógio da semente pode já ser ontem para a API quando a
    // rodada passa da meia-noite, e aí a recusa seria pelo dia, não pelo teto.
    await sheet.getByRole("radio", { name: "Amanhã", exact: true }).click();
    await sheet.getByRole("button", { name: "Criar aviso", exact: true }).click();

    await expect(sheet.getByRole("alert").filter({ hasText: "5 avisos ativos" })).toBeVisible();
    await snap(page, "alerts/limit");

    await sheet.getByRole("button", { name: "Cancelar", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.getByRole("link", { name: "Conta", exact: true }).click();
    await expect(page.getByText("5 de 5", { exact: true })).toBeVisible();
  } finally {
    await clearAlerts(page);
  }
});

test("visitante é convidado a entrar", async ({ page }) => {
  await openBoard(page);
  await page.getByRole("button", { name: "Me avise", exact: true }).click();

  const sheet = page.getByRole("dialog");
  await expect(
    sheet.getByText("Entre para ser avisado quando aparecer carona.", { exact: true }),
  ).toBeVisible();
  await sheet.getByRole("link", { name: "Entrar", exact: true }).click();

  await expect(page).toHaveURL(/\/entrar\?.*returnTo=/);
});
