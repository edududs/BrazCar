import { expect, openBoard, openRide, test } from "./support/fixtures";

/** Caronas lidas dos grupos (ADR-0015, D-117): selo, texto original e contato sem placa. */

test("o card da importada traz o selo via WhatsApp", async ({ page, snap }) => {
  await openBoard(page, "?q=Setor+Tradicional");

  const seal = page.getByText("via WhatsApp");
  await expect(seal.first()).toBeVisible();
  await snap(page, "imported/board-card");
});

test("o detalhe mostra a mensagem original, já redigida", async ({ page, demo, signIn, snap }) => {
  // A mensagem original só aparece para quem tem sessão (D-171); sem isso ela nem nasce na tela.
  await signIn(page, "passenger");
  await openRide(page, demo.ride("imported_external").id);

  await expect(page.getByText("via WhatsApp")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Mensagem original", exact: true })).toBeVisible();
  await expect(page.getByText(demo.groupLabelAt(0))).toBeVisible();
  // O telefone que estava na mensagem não sai daqui (D-128).
  await expect(page.getByRole("blockquote")).not.toContainText("98888-0001");
  await expect(page.getByRole("blockquote")).toContainText("[…]");
  await snap(page, "imported/detail");
});

test("a importada com tarifas mostra o preço de cada parada", async ({ page, demo, snap }) => {
  await openRide(page, demo.ride("imported_fares").id);

  await expect(page.getByText("a partir de")).toBeVisible();
  await expect(page.getByText("R$ 12,00")).toBeVisible();
  await snap(page, "imported/detail-with-fares");
});

test("o contato de motorista externo vem sem placa", async ({ page, demo, signIn, snap }) => {
  await signIn(page, "passenger");
  await openRide(page, demo.ride("imported_external").id);

  await page.getByRole("button", { name: "Pedir contato", exact: true }).click();

  await expect(
    page.getByText("Sem placa cadastrada: confirme o carro com o motorista antes de entrar."),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Falar no WhatsApp", exact: true })).toBeVisible();
  await snap(page, "imported/contact-without-plate");
});

test("a importada de quem tem conta é da dona, e aparece em minhas caronas", async ({
  page,
  demo,
  signIn,
  snap,
}) => {
  await signIn(page, "imported_owner");
  await page.goto("/minhas-caronas");

  await expect(page.getByText("via WhatsApp")).toBeVisible();
  await expect(page.getByText("sua carona")).toBeVisible();
  await snap(page, "imported/owned-in-my-rides");

  await openRide(page, demo.ride("imported_owned").id);
  await expect(page.getByRole("heading", { name: "Sua carona", exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Sua mensagem no grupo", exact: true }),
  ).toBeVisible();
  await snap(page, "imported/owned-detail");
});
