import { expect, openRide, test } from "./support/fixtures";

/** Pedido de remoção do motorista importado (D-162, D-172): a jornada pública, sem conta. */

test("segue o link da carona importada, pede a remoção pelo celular e vê o pedido recebido", async ({
  page,
  demo,
  snap,
}) => {
  await openRide(page, demo.ride("imported_external").id);

  await page
    .getByRole("link", { name: "É sua esta carona? Peça para sair do mural.", exact: true })
    .click();

  await expect(page).toHaveURL(/\/sair-do-mural$/);
  await expect(page.getByRole("heading", { name: "Sair do mural", exact: true })).toBeVisible();
  await snap(page, "removal/form");

  // O celular formata enquanto é digitado, então é digitado, nunca preenchido (D-154).
  await page.getByLabel("Celular", { exact: true }).pressSequentially("61988880099");
  await expect(page.getByLabel("Celular", { exact: true })).toHaveValue("(61) 98888-0099");
  await page.getByRole("button", { name: "Pedir remoção", exact: true }).click();

  await expect(page.getByRole("heading", { name: "Pedido recebido", exact: true })).toBeVisible();
  await snap(page, "removal/received");
});
