import type { Page } from "@playwright/test";

import { chooseDeparture } from "./support/departure";
import { expect, openRide, test } from "./support/fixtures";
import { instant, localInput } from "./support/time";

/**
 * O motorista: publicar, editar, mexer nas vagas, cancelar e repetir.
 *
 * Toda jornada que muda uma carona publica a sua própria antes: celular e desktop rodam no mesmo
 * banco, e nenhum dos dois pode fechar ou cancelar o que o outro ainda vai fotografar.
 */

function stops(page: Page) {
  return page.getByRole("group", { name: "Trajeto" }).locator("> div");
}

/** Escolhe um lugar do catálogo numa parada, como a pessoa faz: digita e clica na lista. */
async function pickPlace(page: Page, index: number, label: string, place: string): Promise<void> {
  await stops(page).nth(index).getByLabel(label).fill(place);
  await page.getByRole("option", { name: place, exact: true }).click();
}

test("sem carro, publicar manda cadastrar um", async ({ page, signIn, snap }) => {
  await signIn(page, "driver_no_car");
  await page.goto("/publicar");

  await expect(
    page.getByRole("heading", { name: "Cadastre um carro para publicar" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Cadastrar um carro" })).toBeVisible();
  await snap(page, "publish/without-a-car");
});

test("publicar uma carona simples", async ({ page, demo, signIn, snap }) => {
  const notes = "Passo no posto antes de pegar a estrada.";
  await signIn(page, "driver_one_car");
  await page.goto("/publicar");

  await expect(page.getByRole("heading", { name: "Publicar carona", level: 1 })).toBeVisible();
  await snap(page, "publish/empty");

  await page.getByLabel("Carro").selectOption({ index: 1 });
  await pickPlace(page, 0, "Sai de", "Veredas");
  await pickPlace(page, 1, "Vai para", "Ceasa");
  await chooseDeparture(page, localInput(demo.anchor, 8 * 60));
  await page.getByRole("button", { name: "Pôr uma vaga" }).click();
  await page.getByLabel("Preço", { exact: true }).fill("8.00");
  await page.getByLabel("Observações").fill(notes);
  await expect(page.getByText(`${String(notes.length)}/500`)).toBeVisible();
  await snap(page, "publish/filled");

  await page.getByRole("button", { name: "Publicar" }).click();

  await expect(page).toHaveURL(/\/caronas\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("listitem").filter({ hasText: "Veredas" })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "Ceasa" })).toBeVisible();
  await expect(page.getByText("R$ 8,00")).toBeVisible();
  await expect(page.getByText(notes)).toBeVisible();
  await expect(page.getByText("Carona publicada. Já está no mural.")).toBeVisible();
  await snap(page, "ride/just-published");
});

test("observação com telefone é recusada com a frase do botão", async ({
  page,
  demo,
  signIn,
  snap,
}) => {
  await signIn(page, "driver_one_car");
  await page.goto("/publicar");

  await page.getByLabel("Carro").selectOption({ index: 1 });
  await pickPlace(page, 0, "Sai de", "Rodeador");
  await pickPlace(page, 1, "Vai para", "SAAN");
  await chooseDeparture(page, localInput(demo.anchor, 9 * 60));
  await page.getByLabel("Observações").fill("Chama no 61 99999-0000 que eu confirmo a vaga");
  await page.getByRole("button", { name: "Publicar" }).click();

  await expect(page.getByRole("alert")).toContainText("o contato sai pelo botão de contato");
  await snap(page, "publish/personal-data-refused");
});

test("com preço por parada, o preço da carona some do formulário", async ({
  page,
  demo,
  signIn,
  snap,
}) => {
  await signIn(page, "driver_two_cars");
  await page.goto("/publicar");

  await page.getByLabel("Carro").selectOption({ index: 1 });
  await page.getByRole("button", { name: "Adicionar parada no caminho" }).click();
  await page.getByRole("button", { name: "Adicionar parada no caminho" }).click();
  await expect(stops(page)).toHaveCount(4);
  await expect(stops(page).nth(1).getByRole("button", { name: "Remover parada" })).toBeVisible();
  await page.getByRole("switch", { name: "Preço diferente por parada" }).click();

  await pickPlace(page, 0, "Sai de", "Fassincra");
  await pickPlace(page, 1, "Parada no caminho", "Estrutural");
  await pickPlace(page, 2, "Parada no caminho", "SIA");
  await pickPlace(page, 3, "Vai para", "Esplanada");
  await stops(page).nth(1).getByLabel("Preço até aqui").fill("6.00");
  await stops(page).nth(2).getByLabel("Preço até aqui").fill("9.00");
  await stops(page).nth(3).getByLabel("Preço até aqui").fill("12.00");

  await expect(page.getByLabel("Preço", { exact: true })).toHaveCount(0);
  await chooseDeparture(page, localInput(demo.anchor, 10 * 60));
  await snap(page, "publish/fares-per-stop");

  await page.getByRole("button", { name: "Publicar" }).click();

  await expect(page).toHaveURL(/\/caronas\/[0-9a-f-]{36}$/);
  await expect(page.getByText("a partir de")).toBeVisible();
  await expect(page.getByText("R$ 6,00").first()).toBeVisible();
});

test("uma parada em texto livre entra na rota", async ({ page, demo, signIn, snap }) => {
  await signIn(page, "driver_one_car");
  await page.goto("/publicar");

  await page.getByLabel("Carro").selectOption({ index: 1 });
  await pickPlace(page, 0, "Sai de", "Vendinha");
  await stops(page).nth(1).getByLabel("Vai para").fill("Portão da escola, quadra 12");
  await expect(page.getByText(/vale como você escreveu/)).toBeVisible();
  // Tapping elsewhere keeps the typed text as the stop (D-123) and closes the list. While the list
  // is open the rest of the page is aria-hidden, so the tap goes by CSS, not by role.
  await page.locator("h1").click();
  await expect(stops(page).nth(1).getByLabel("Vai para")).toHaveValue(
    "Portão da escola, quadra 12",
  );
  await chooseDeparture(page, localInput(demo.anchor, 11 * 60));
  await snap(page, "publish/free-text-stop");

  await page.getByRole("button", { name: "Publicar" }).click();

  await expect(
    page.getByRole("listitem").filter({ hasText: "Portão da escola, quadra 12" }),
  ).toBeVisible();
});

test("minhas caronas mostram também a cancelada e a que já saiu", async ({
  page,
  signIn,
  snap,
}) => {
  await signIn(page, "driver_one_car");
  await page.goto("/minhas-caronas");

  await expect(page.getByRole("heading", { name: "Minhas caronas", level: 1 })).toBeVisible();
  await expect(page.getByText("Cancelada", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Já saiu", { exact: true })).toBeVisible();
  await expect(page.getByText("sua carona").first()).toBeVisible();
  await snap(page, "my-rides/full");
});

test("minhas caronas de quem nunca publicou", async ({ page, signIn, snap }) => {
  await signIn(page, "fresh");
  await page.goto("/minhas-caronas");

  await expect(page.getByText("Você ainda não publicou caronas.")).toBeVisible();
  await snap(page, "my-rides/empty");
});

test("o dono fecha e reabre a carona pelas vagas", async ({
  page,
  demo,
  signIn,
  publishFor,
  snap,
}) => {
  await signIn(page, "driver_one_car");
  const rideId = await publishFor(page, "driver_one_car", {
    stops: ["incra-8", "setor-policial"],
    departureAt: instant(demo.anchor, 12 * 60),
    seats: 2,
  });
  await openRide(page, rideId);

  await expect(page.getByRole("heading", { name: "Sua carona" })).toBeVisible();
  await snap(page, "ride/owner-open");

  const minus = page.getByRole("button", { name: "Tirar uma vaga" });
  await minus.click();
  await minus.click();
  await expect(page.getByText("Ponha uma vaga para reabrir.")).toBeVisible();
  await expect(page.getByText("Lotada", { exact: true })).toBeVisible();
  await snap(page, "ride/owner-full");

  await page.getByRole("button", { name: "Pôr uma vaga" }).click();
  await expect(page.getByText("Reaberta", { exact: true })).toBeVisible();
  await snap(page, "ride/owner-reopened");
});

test("editar: o mesmo dia passa, outro dia é recusado", async ({
  page,
  demo,
  signIn,
  publishFor,
  snap,
}) => {
  await signIn(page, "driver_one_car");
  const rideId = await publishFor(page, "driver_one_car", {
    stops: ["ouro-verde", "brasil-21"],
    departureAt: instant(demo.anchor, 13 * 60),
  });
  await page.goto(`/caronas/${rideId}/editar`);

  await expect(page.getByRole("heading", { name: "Editar carona", level: 1 })).toBeVisible();
  await expect(
    page.getByText("Antes de sair, o horário só muda dentro do mesmo dia."),
  ).toBeVisible();
  await expect(page.getByLabel("Vagas")).toHaveCount(0);
  await snap(page, "edit/form");

  // Outro dia é outra carona: a folha já vem com os outros dias apagados e a frase explica (F7).
  await page.getByRole("button", { name: /^Dia:/ }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByRole("button", { name: /^Amanhã/ })).toBeDisabled();
  await expect(sheet.getByText("Para outro dia, use Repetir.")).toBeVisible();
  await snap(page, "edit/other-day-refused");
  await sheet.getByRole("button", { name: "Fechar" }).click();

  await chooseDeparture(page, localInput(demo.anchor, 13 * 60 + 30));
  await page.getByLabel("Observações").fill("Mudei o horário: saio meia hora depois.");
  await page.getByRole("button", { name: "Salvar" }).click();

  await expect(page).toHaveURL(new RegExp(`/caronas/${rideId}$`));
  await expect(page.getByText("Mudei o horário: saio meia hora depois.")).toBeVisible();
  await snap(page, "ride/owner-edited");
});

test("cancelar pede confirmação e é definitivo", async ({
  page,
  demo,
  signIn,
  publishFor,
  snap,
}) => {
  await signIn(page, "driver_one_car");
  const rideId = await publishFor(page, "driver_one_car", {
    stops: ["assentamento", "octogonal"],
    departureAt: instant(demo.anchor, 14 * 60),
  });
  await openRide(page, rideId);

  await page.getByRole("button", { name: "Cancelar carona" }).click();
  await expect(page.getByText("Cancelar esta carona?")).toBeVisible();
  await snap(page, "ride/cancel-dialog");

  await page.getByRole("alertdialog").getByRole("button", { name: "Cancelar carona" }).click();
  await expect(page.getByText("Cancelada", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancelar carona" })).toHaveCount(0);
  await snap(page, "ride/owner-cancelled");
});

test("repetir uma carona publica outra igual em outro horário", async ({
  page,
  demo,
  signIn,
  snap,
}) => {
  await signIn(page, "driver_two_cars");
  const ride = demo.ride("tomorrow_many_stops");
  await openRide(page, ride.id);

  await expect(page.getByRole("listitem").filter({ hasText: "Aeroporto" })).toBeVisible();
  await page.getByRole("button", { name: "Repetir Publica outra igual em outro horário" }).click();
  await page.getByLabel("Repetir esta carona em").fill(localInput(demo.anchor, 100 * 60));
  await snap(page, "ride/repeat-ready");
  await page.getByRole("button", { name: "Repetir carona" }).click();

  await expect(page).toHaveURL(/\/caronas\/[0-9a-f-]{36}$/);
  await expect(page).not.toHaveURL(new RegExp(ride.id));
  await expect(page.getByRole("listitem").filter({ hasText: "Aeroporto" })).toBeVisible();
  await snap(page, "ride/repeated");
});
