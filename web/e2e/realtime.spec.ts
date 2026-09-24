import { expect, openBoard, test } from "./support/fixtures";
import { instant } from "./support/time";

/**
 * O mural se atualiza sozinho (ADR-0010, D-104): um segundo contexto publica, o primeiro percebe
 * pelo sinal SSE e busca de novo, sem ninguém recarregar a página.
 */

const cards = 'a[href^="/caronas/"]';

test("o mural do visitante aprende a carona que outro acabou de publicar", async ({
  page,
  browser,
  demo,
  signIn,
  publishFor,
  snap,
}) => {
  await openBoard(page);
  const before = await page.locator(cards).count();
  await snap(page, "realtime/before");

  const other = await browser.newContext();
  const driver = await other.newPage();
  try {
    await signIn(driver, "driver_two_cars");
    await publishFor(driver, "driver_two_cars", {
      stops: ["setor-norte", "setor-bancario-norte"],
      departureAt: instant(demo.anchor, 15 * 60),
    });
  } finally {
    await other.close();
  }

  // Sem recarregar: o sinal chega, o app espera o sorteio de até 2s e busca a lista (D-047).
  await expect(page.locator(cards)).toHaveCount(before + 1, { timeout: 20_000 });
  await expect(page.getByText("Setor Norte").first()).toBeVisible();
  await snap(page, "realtime/after");
});
