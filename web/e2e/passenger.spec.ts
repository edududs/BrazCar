import { expect, openRide, test } from "./support/fixtures";

/** O passageiro: pedir o contato, e o que acontece quando a cota do dia acabou (ADR-0006, D-097). */

test("pedir contato revela o WhatsApp e a placa", async ({ page, demo, signIn, snap }) => {
  await signIn(page, "passenger");
  await openRide(page, demo.ride("open_today_simple").id);

  const ask = page.getByRole("button", { name: "Pedir contato", exact: true });
  await expect(ask).toBeVisible();
  await snap(page, "contact/before");

  await ask.click();

  const link = page.getByRole("link", { name: "Falar no WhatsApp", exact: true });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute("href", /^https:\/\/wa\.me\/55/);
  await expect(page.getByText(/^\(\d{2}\) \d{5}-\d{4}$/)).toBeVisible();
  await expect(page.getByLabel(/^Placa [A-Z0-9]+$/)).toBeVisible();
  await snap(page, "contact/revealed");
});

test("com a cota do dia gasta, o pedido é recusado na própria tela", async ({
  page,
  demo,
  signIn,
  snap,
}) => {
  await signIn(page, "long_name");
  await openRide(page, demo.ride("open_today_notes").id);

  await page.getByRole("button", { name: "Pedir contato", exact: true }).click();

  await expect(page.getByRole("alert")).toContainText("muitos pedidos de contato");
  await expect(page.getByRole("link", { name: "Falar no WhatsApp", exact: true })).toHaveCount(0);
  await snap(page, "contact/limit-reached");
});

test("carona lotada não oferece o botão nem para quem está logado", async ({
  page,
  demo,
  signIn,
  snap,
}) => {
  await signIn(page, "passenger");
  await openRide(page, demo.ride("full_today").id);

  await expect(page.getByText("Lotada", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Pedir contato", exact: true })).toHaveCount(0);
  await snap(page, "contact/none-when-full");
});

test("carona cancelada não oferece o botão nem para quem está logado", async ({
  page,
  demo,
  signIn,
  snap,
}) => {
  await signIn(page, "passenger");
  await openRide(page, demo.ride("cancelled_today").id);

  await expect(page.getByText("Cancelada", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Pedir contato", exact: true })).toHaveCount(0);
  await snap(page, "contact/none-when-cancelled");
});
