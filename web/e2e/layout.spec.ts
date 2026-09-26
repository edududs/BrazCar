import type { Locator, Page } from "@playwright/test";

import { expect, openRide, test } from "./support/fixtures";

/**
 * What only a real layout can show: nothing the person needs ends up under the bar that holds
 * the page's action. Scrolled to the end, the last field or card must end above the bar's top.
 */

async function bottomOf(locator: Locator): Promise<number> {
  const box = await locator.boundingBox();
  if (box === null) throw new Error("not on screen");
  return box.y + box.height;
}

async function topOf(locator: Locator): Promise<number> {
  const box = await locator.boundingBox();
  if (box === null) throw new Error("not on screen");
  return box.y;
}

async function scrollToEnd(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.scrollTo(0, document.documentElement.scrollHeight);
  });
}

test("publicar: rolado até o fim, as observações terminam acima do botão fixo", async ({
  page,
  signIn,
}) => {
  await signIn(page, "driver_one_car");
  await page.goto("/publicar");
  const notes = page.getByLabel("Observações");
  const publish = page.getByRole("button", { name: "Publicar carona", exact: true });
  await expect(notes).toBeVisible();

  await scrollToEnd(page);
  expect(await bottomOf(notes)).toBeLessThanOrEqual(await topOf(publish));
  await expect(notes).toBeInViewport({ ratio: 1 });
});

test("detalhe: rolado até o fim, o último cartão termina acima da barra de ação", async ({
  page,
  demo,
  signIn,
}) => {
  // Sem sessão as observações longas somem (D-171) e a página fica curta demais para medir; entrar
  // como passageira devolve o texto que estica a tela até perto da barra fixa.
  await signIn(page, "passenger");
  await openRide(page, demo.ride("open_today_long_notes").id);
  const action = page.getByRole("button", { name: "Pedir contato", exact: true });
  const lastCard = page.locator("main section").last();
  await expect(action).toBeVisible();

  await scrollToEnd(page);
  expect(await bottomOf(lastCard)).toBeLessThanOrEqual(await topOf(action));
});
