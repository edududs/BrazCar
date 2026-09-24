import { expect, test } from "./support/fixtures";

/** Entrar no BrazCar: criar conta, entrar, recuperar a senha e cuidar dos carros. */

test("criar conta: os erros aparecem e a conta entra direto no mural", async ({
  page,
  demo,
  isMobile,
  snap,
}) => {
  // Um número por projeto: celular e desktop rodam a mesma jornada no mesmo banco.
  const phone = demo.suitePhoneAt(isMobile ? 0 : 1);
  await page.goto("/cadastro");
  await expect(page.getByRole("heading", { name: "Criar conta", level: 1 })).toBeVisible();
  await snap(page, "signup/empty");

  await page.getByLabel("Telefone").fill("61 9");
  await page.getByLabel("Nome").fill("Visitante de Demonstração");
  await page.getByLabel(/^Senha/).fill("123");
  await page.getByLabel("Li e aceito os termos").check();
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await snap(page, "signup/refused");

  // Digitado como se digita: com país, parênteses, o nove solto e hífen; o campo arruma sozinho.
  const [area, rest] = [phone.slice(3, 5), phone.slice(5)];
  const field = page.getByLabel("Telefone");
  await field.clear();
  await field.pressSequentially(
    `+55 (${area}) ${rest.slice(0, 1)} ${rest.slice(1, 5)}-${rest.slice(5)}`,
  );
  await expect(field).toHaveValue(`+55 ${area} ${rest.slice(0, 5)} ${rest.slice(5)}`);
  await page.getByLabel(/^Senha/).fill("uma-senha-de-demonstracao");
  await snap(page, "signup/phone-formatted");
  await page.getByRole("button", { name: "Criar conta" }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("link", { name: "Conta" })).toBeVisible();
  await snap(page, "board/signed-in");

  await page.getByRole("link", { name: "Conta" }).click();
  await expect(page.getByText(`(${area}) ${rest.slice(0, 5)}-${rest.slice(5)}`)).toBeVisible();
});

test("entrar: senha errada é recusada e a certa leva ao mural", async ({ page, demo, snap }) => {
  const driver = demo.account("driver_one_car");
  await page.goto("/entrar");
  await expect(page.getByRole("heading", { name: "Entrar", level: 1 })).toBeVisible();
  await snap(page, "login/empty");

  await page.getByLabel("Telefone").fill(driver.phone);
  await page.getByLabel(/^Senha/).fill("senha-que-nao-e-a-dela");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByText("telefone ou senha incorretos")).toBeVisible();
  await snap(page, "login/wrong-password");

  await page.getByLabel(/^Senha/).fill(driver.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("link", { name: "Conta" })).toBeVisible();
});

test("esqueci a senha: a resposta é a mesma para qualquer telefone", async ({
  page,
  demo,
  snap,
}) => {
  await page.goto("/esqueci-senha");
  await expect(page.getByRole("heading", { name: "Esqueci a senha", level: 1 })).toBeVisible();
  await snap(page, "password-reset/request");

  await page.getByLabel("Telefone").fill(demo.account("driver_one_car").phone);
  await page.getByRole("button", { name: "Enviar link" }).click();

  await expect(
    page.getByText("Se este telefone tiver conta com e-mail, o link para redefinir a senha já foi"),
  ).toBeVisible();
  await snap(page, "password-reset/sent");
});

test("link de redefinir sem token pede outro", async ({ page, snap }) => {
  await page.goto("/redefinir-senha");

  await expect(page.getByText("Este link está incompleto.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Pedir outro" })).toBeVisible();
  await snap(page, "password-reset/incomplete-link");
});

test("a conta sem sessão manda entrar", async ({ page, snap }) => {
  await page.goto("/conta");

  await expect(page.getByText("Você não está conectado.")).toBeVisible();
  await snap(page, "account/anonymous");
});

test("conta nova: nenhum carro, e o convite fala no singular", async ({ page, signIn, snap }) => {
  await signIn(page, "fresh");
  await page.goto("/conta");

  await expect(page.getByRole("heading", { name: "Minha conta", level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: "Cadastrar um carro" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Remover" })).toHaveCount(0);
  await snap(page, "account/no-cars");
});

test("nome social longo cabe na conta", async ({ page, demo, signIn, snap }) => {
  await signIn(page, "long_name");
  await page.goto("/conta");

  await expect(page.getByText(demo.account("long_name").displayName)).toBeVisible();
  await snap(page, "account/long-name");
});

test("carros: cadastrar, ver na lista e remover", async ({ page, signIn, snap }) => {
  await signIn(page, "driver_two_cars");
  await page.goto("/conta");

  await expect(page.getByRole("button", { name: "Remover" })).toHaveCount(2);
  await snap(page, "account/with-cars");

  await page.getByRole("button", { name: "Adicionar outro carro" }).click();
  await expect(page.getByLabel("Placa")).toBeVisible();
  await snap(page, "account/car-form");

  await page.getByLabel("Modelo").fill("Fiesta");
  await page.getByLabel("Cor").fill("azul");
  await page.getByLabel("Placa").fill("DEM7X77");
  await page.getByRole("button", { name: "Salvar carro" }).click();

  await expect(page.getByRole("button", { name: "Remover" })).toHaveCount(3);
  await expect(page.getByText("Fiesta, azul · DEM7X77")).toBeVisible();
  await snap(page, "account/car-added");

  await page.getByRole("button", { name: "Remover" }).last().click();
  await expect(page.getByRole("button", { name: "Remover" })).toHaveCount(2);
});

test("sair da conta devolve o visitante ao mural público", async ({ page, signIn, snap }) => {
  await signIn(page, "passenger");
  await page.goto("/conta");

  await page.getByRole("button", { name: "Sair da conta" }).click();
  await expect(page.getByText("Você não está conectado.")).toBeVisible();
  await snap(page, "account/signed-out");
});

test("excluir conta: o diálogo explica, confirma, e o telefone deixa de servir para entrar", async ({
  page,
  demo,
  isMobile,
  snap,
}) => {
  // Conta própria deste teste, criada aqui (não da semente), para não desligar da sessão de
  // nenhuma outra jornada que divide o mesmo banco. Um número por projeto, como o cadastro.
  const phone = demo.suitePhoneAt(isMobile ? 2 : 3);
  const password = "uma-senha-de-demonstracao";
  await page.goto("/cadastro");
  await page.getByLabel("Telefone").fill(phone);
  await page.getByLabel("Nome").fill("Conta Para Excluir");
  await page.getByLabel(/^Senha/).fill(password);
  await page.getByLabel("Li e aceito os termos").check();
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page).toHaveURL(/\/$/);

  await page.goto("/conta");
  await page.getByRole("button", { name: "Excluir conta" }).click();
  await expect(page.getByText("Excluir sua conta?")).toBeVisible();
  await expect(
    page.getByText("A conta some e as caronas publicadas por ela saem do mural."),
  ).toBeVisible();
  await snap(page, "account/delete-dialog");

  await page.getByRole("alertdialog").getByRole("button", { name: "Excluir conta" }).click();
  await expect(page.getByRole("heading", { name: "Caronas", level: 1 })).toBeVisible();
  await expect(page.getByText("Conta excluída.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Entrar", exact: true })).toBeVisible();
  await snap(page, "account/deleted");

  await page.goto("/entrar");
  await page.getByLabel("Telefone").fill(phone);
  await page.getByLabel(/^Senha/).fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByText("telefone ou senha incorretos")).toBeVisible();
});
