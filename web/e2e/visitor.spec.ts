import type { Page } from "@playwright/test";

import { expect, openBoard, openRide, test } from "./support/fixtures";
import { clockOf } from "./support/time";

/**
 * Quem chega sem conta: o mural, os filtros, uma carona e os becos sem saída.
 *
 * As afirmações são por carona, nunca por total: as outras jornadas publicam no mesmo banco, e um
 * número fixo de cards só diria em que ordem os arquivos rodaram.
 */

const cards = 'a[href^="/caronas/"]';

function cardFor(page: Page, rideId: string) {
  return page.locator(`a[href="/caronas/${rideId}"]`);
}

test("o mural lista as caronas que ainda vão sair, e só elas", async ({ page, demo, snap }) => {
  await openBoard(page);

  for (const ride of demo.rides) {
    await expect(cardFor(page, ride.id), ride.slug).toHaveCount(ride.onBoard ? 1 : 0);
  }
  await expect(page.getByText("Já saiu", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Cancelada", { exact: true })).toHaveCount(0);
  await expect(page.getByText("via WhatsApp").first()).toBeVisible();
  await snap(page, "board/full");
});

test("o filtro de dia vive na URL e recorta o mural", async ({ page, demo, snap }) => {
  const today = demo.dayAt(0);
  await openBoard(page);

  await page.getByRole("button", { name: "Hoje", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`day=${today}`));

  for (const ride of demo.rides.filter((each) => each.onBoard)) {
    await expect(cardFor(page, ride.id), ride.slug).toHaveCount(ride.day === today ? 1 : 0);
  }
  await snap(page, "board/filtered-by-day");
});

test('o filtro "a partir de" recorta o mural pelo horário local, sem dia e com dia', async ({
  page,
  demo,
  snap,
}) => {
  await openBoard(page, "?from=18:00");

  for (const ride of demo.rides.filter((each) => each.onBoard)) {
    const expected = clockOf(ride.departureAt) >= "18:00";
    await expect(cardFor(page, ride.id), ride.slug).toHaveCount(expected ? 1 : 0);
  }
  await expect(page).toHaveURL(/from=18:00/);
  await snap(page, "board/from-time");

  const today = demo.dayAt(0);
  await page.getByRole("button", { name: "Hoje", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`day=${today}`));

  for (const ride of demo.rides.filter((each) => each.onBoard)) {
    const expected = ride.day === today && clockOf(ride.departureAt) >= "18:00";
    await expect(cardFor(page, ride.id), ride.slug).toHaveCount(expected ? 1 : 0);
  }
});

test('o filtro "a partir de" sem carona no horário mostra o estado vazio', async ({
  page,
  demo,
  snap,
}) => {
  // 23:59 é depois de qualquer horário que a semente ou as outras jornadas publiquem.
  const today = demo.dayAt(0);

  await openBoard(page, `?day=${today}&from=23:59`);

  await expect(page.getByText("Nenhuma carona com esses filtros.")).toBeVisible();
  await expect(page.locator(cards)).toHaveCount(0);
  await snap(page, "board/from-time-empty");
});

test("só com vaga tira a lotada do mural", async ({ page, demo, snap }) => {
  const full = demo.ride("full_today");
  await openBoard(page);
  await expect(cardFor(page, full.id)).toHaveCount(1);
  await expect(page.getByText("Lotada", { exact: true }).first()).toBeVisible();

  await page.getByRole("button", { name: "Com vaga", exact: true }).click();
  await expect(page).toHaveURL(/withSeats=true/);

  await expect(cardFor(page, full.id)).toHaveCount(0);
  await expect(cardFor(page, demo.ride("open_today_simple").id)).toHaveCount(1);
  await expect(page.getByText("Lotada", { exact: true })).toHaveCount(0);
  await snap(page, "board/only-with-seats");
});

test('"passa por" acha o lugar pelo apelido', async ({ page, demo, snap }) => {
  // "SCS" é apelido do Setor Comercial Sul; nenhuma parada se chama assim na tela (D-101).
  await openBoard(page);
  await page.getByLabel("Passa por").fill("SCS");
  await expect(page).toHaveURL(/q=SCS/);

  const card = cardFor(page, demo.ride("full_today").id);
  await expect(card).toBeVisible();
  await expect(card).toContainText("Setor Comercial Sul");
  await expect(card).not.toContainText("SCS");
  await expect(cardFor(page, demo.ride("open_today_simple").id)).toHaveCount(0);
  await snap(page, "board/search-by-alias");
});

test('"passa por" acha o lugar pelo que está acima dele', async ({ page, demo, snap }) => {
  // A carona passa pela Esplanada, que fica dentro do Plano Piloto: ninguém escreveu "Plano".
  await openBoard(page, "?q=Plano+Piloto");

  const card = cardFor(page, demo.ride("open_today_simple").id);
  await expect(card).toBeVisible();
  await expect(card).toContainText("Esplanada");
  await expect(card).not.toContainText("Plano Piloto");
  await snap(page, "board/search-by-parent");
});

test("filtro que não acha nada explica que é filtro", async ({ page, snap }) => {
  await openBoard(page, "?q=Lago+Sul");

  await expect(page.getByText("Nenhuma carona com esses filtros.")).toBeVisible();
  await expect(page.locator(cards)).toHaveCount(0);
  await snap(page, "board/empty-by-filter");
});

test("o detalhe de uma carona aberta convida a entrar para pedir contato", async ({
  page,
  snap,
}) => {
  await openBoard(page);
  await page.locator(cards).first().click();

  await expect(page).toHaveURL(/\/caronas\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: "Carona", exact: true, level: 1 })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Entrar para pedir contato", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Pedir contato", exact: true })).toHaveCount(0);
  await snap(page, "ride/open-anonymous");
});

test("carona lotada não oferece contato", async ({ page, demo, snap }) => {
  await openRide(page, demo.ride("full_today").id);

  await expect(page.getByText("Lotada", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Pedir contato", exact: true })).toHaveCount(0);
  await snap(page, "ride/full");
});

test("carona que já saiu não oferece contato", async ({ page, demo, snap }) => {
  await openRide(page, demo.ride("departed_earlier").id);

  await expect(page.getByText("Já saiu", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Pedir contato", exact: true })).toHaveCount(0);
  await snap(page, "ride/departed");
});

test("carona cancelada continua legível pelo endereço", async ({ page, demo, snap }) => {
  await openRide(page, demo.ride("cancelled_today").id);

  await expect(page.getByText("Cancelada", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Pedir contato", exact: true })).toHaveCount(0);
  await snap(page, "ride/cancelled");
});

test("carona com preço por parada mostra cada tarifa", async ({ page, demo, snap }) => {
  await openRide(page, demo.ride("open_today_fares").id);

  await expect(page.getByText("a partir de").first()).toBeVisible();
  await expect(page.getByText("R$ 15,00")).toBeVisible();
  await snap(page, "ride/fares-per-stop");
});

test("carona com observações longas mostra o texto inteiro", async ({
  page,
  demo,
  signIn,
  snap,
}) => {
  // As observações só aparecem para quem tem sessão (D-171); sem isso o texto nem nasce na tela.
  await signIn(page, "passenger");
  await openRide(page, demo.ride("open_today_long_notes").id);

  await expect(page.getByText("Obrigado, e que a gente chegue bem.")).toBeVisible();
  await snap(page, "ride/long-notes");
});

test("sem sessão, o detalhe some com quem dirige e o que só ela escreveu", async ({
  page,
  demo,
}) => {
  // D-171: sem sessão, nome do motorista, mensagem original e observações somem; horário, paradas
  // e valor continuam.
  const notes = demo.ride("open_today_long_notes");
  await openRide(page, notes.id);

  await expect(page.getByText("Obrigado, e que a gente chegue bem.")).toHaveCount(0);
  await expect(page.getByText("Ana Paula Ribeiro")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Mensagem original", exact: true })).toHaveCount(
    0,
  );
  await expect(page.getByText(clockOf(notes.departureAt))).toBeVisible();
  await expect(page.getByText("Brazlândia")).toBeVisible();
  await expect(page.getByText("Setor Bancário Sul")).toBeVisible();
  await expect(page.getByText("R$ 7,00").first()).toBeVisible();

  const external = demo.ride("imported_external");
  await openRide(page, external.id);

  await expect(
    page.getByText("Bom dia! 3 vagas saindo do Setor Tradicional às 6h30 para a Esplanada"),
  ).toHaveCount(0);
  await expect(page.getByText("Marcos das Caronas")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Mensagem original", exact: true })).toHaveCount(
    0,
  );
  await expect(page.getByText(clockOf(external.departureAt))).toBeVisible();
  await expect(page.getByText("Setor Tradicional")).toBeVisible();
  await expect(page.getByText("Esplanada")).toBeVisible();
  await expect(page.getByText("R$ 7,00").first()).toBeVisible();
});

test("endereço de carona que não existe explica o que houve", async ({ page, snap }) => {
  await page.goto("/caronas/00000000-0000-4000-8000-000000000000");

  await expect(
    page.getByRole("heading", { name: "Esta carona não existe", exact: true }),
  ).toBeVisible();
  await snap(page, "ride/not-found");
});

test("endereço que não é rota nenhuma explica em português e leva ao mural", async ({
  page,
  snap,
}) => {
  await page.goto("/uma-pagina-que-nao-existe");

  await expect(
    page.getByRole("heading", { name: "Página não encontrada", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Este endereço não existe no BrazCar.")).toBeVisible();
  await snap(page, "shell/route-not-found");

  await page.getByRole("link", { name: "Voltar ao mural", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("sem internet o app avisa por cima da página", async ({ page, context, snap }) => {
  await openBoard(page);

  await context.setOffline(true);
  await expect(page.getByRole("alert")).toContainText("Sem internet");
  await snap(page, "shell/offline");

  await context.setOffline(false);
  await expect(page.getByRole("alert")).toBeHidden();
  await expect(page.getByRole("heading", { name: "Caronas", exact: true, level: 1 })).toBeVisible();
});

test("abaixo do piso de versão o app só oferece atualizar", async ({ page, snap }) => {
  await page.route("**/api/web-version", async (route) => {
    await route.fulfill({ json: { minimum: "99.0.0" } });
  });

  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Atualize o BrazCar", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Atualizar agora", exact: true })).toBeVisible();
  await snap(page, "shell/version-required");
});

test("no iPhone, a dica de instalar aparece e some quando dispensada", async ({
  page,
  isMobile,
  snap,
}) => {
  test.skip(!isMobile, "a dica só existe em aba de navegador no iPhone (D-106)");
  await openBoard(page);

  const hint = page.getByRole("complementary", { name: "Use como app", exact: true });
  await expect(hint).toBeVisible();
  await snap(page, "shell/install-hint");

  await page.getByRole("button", { name: "Agora não", exact: true }).click();
  await expect(hint).toBeHidden();
});
