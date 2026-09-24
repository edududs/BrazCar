# Telas: semente, suíte de ponta a ponta e catálogo

Como encher um banco de demonstração, rodar o Playwright por todas as jornadas e refazer o
[catálogo de telas](../screens/README.md). As decisões estão em
[D-133 e D-134](../decisions/README.md); o porquê das imagens, em [D-103](../decisions/README.md).

## O que é cada peça

| Peça | Onde | Para quê |
|---|---|---|
| Semente de demonstração | `backend/src/brazcar/demo/` | um banco com uma carona de cada situação |
| Suíte de ponta a ponta | `web/e2e/` | percorre o app inteiro e afirma o resultado de cada passo |
| Fotografia | `web/e2e/support/fixtures.ts`, função `snap` | o único lugar que tira print |
| Catálogo | `scripts/screens-catalog.mjs` | escreve `docs/screens/README.md` a partir dos prints |

## De uma vez

```bash
cd web
yarn playwright install chromium   # uma vez por máquina
yarn screens                       # apaga docs/screens/, roda tudo, refaz o catálogo
```

`yarn screens` sobe sozinho a API e o front: não é preciso ter nada rodando antes. Ele usa um
SQLite próprio (`backend/e2e.sqlite3`), a API em `localhost:8100` e o front construído servido por
`vite preview` em `localhost:4173`. Os dois em `localhost` de propósito: o cookie de sessão é
`SameSite=Lax` (ADR-0012) e porta não conta como site, então front e API ficam do mesmo site ali,
como são subdomínios irmãos em produção. Trocar um dos dois por `127.0.0.1` derruba a sessão.

Só rodar a suíte, sem mexer nas imagens já commitadas:

```bash
cd web && yarn e2e
yarn e2e --project=mobile          # só o celular
yarn e2e --ui                      # modo interativo, para depurar
```

O relatório HTML e os traces ficam em `web/e2e/.state/` e não são versionados. As imagens e o
`docs/screens/README.md`, sim.

## Só a semente

```bash
cd backend
uv run python manage.py migrate
uv run python manage.py sync_places          # o seed precisa do catálogo de lugares (D-087)
uv run poe serve                             # em outro terminal, se quiser abrir no navegador
DJANGO_DEBUG=1 uv run python manage.py seed_demo --manifest ../web/e2e/.state/manifest.json
```

- Ele **se recusa a rodar** fora de `DJANGO_DEBUG=1`. Para rodar mesmo assim, de propósito:
  `--yes-i-know`.
- Ele **apaga o que ele mesmo criou antes de recriar**, então rodar duas vezes deixa as mesmas
  linhas. Só apagar: `--forget`.
- O alcance dele é fechado pelos próprios dados: os telefones de
  `backend/src/brazcar/demo/adapters/dataset.py` e o número pareado do worker de demonstração.
  Nada fora disso é tocado.
- Senha de todas as contas: a constante `PASSWORD` do mesmo arquivo. É fictícia e está escrita ali
  de propósito.
- Uma conta excluída pela interface deixa a linha anônima para trás (D-090). O telefone volta a
  ficar livre, então a semente roda de novo sem conflito, mas aquela linha não é mais reconhecida.

O `--manifest` grava o que foi criado (identificadores, dias, situações). A suíte lê esse arquivo
em vez de carregar constantes que envelheceriam: os identificadores nascem no domínio e mudam a
cada execução, os apelidos (`open_today_simple`, `imported_external`…) não.

## Acrescentar um estado ao catálogo

1. Se o estado precisa de dado que ainda não existe, acrescente-o em `demo/adapters/dataset.py` e
   em `demo/adapters/seeding.py`, e cubra a promessa em `backend/tests/demo/test_seed_demo.py`.
2. Na jornada certa de `web/e2e/*.spec.ts`, leve a tela ao estado **interagindo** (clicando,
   digitando), afirme o que mudou e só então chame `snap(page, "<jornada>/<estado>")`.
   - O nome é em inglês, estável e sem hora: ele vira `docs/screens/<projeto>/<jornada>/<estado>.png`.
   - Nunca chame `page.screenshot` direto: o `snap` é quem decide tamanho, espera e o registro que
     o catálogo lê.
3. `yarn screens`. Confira o `git diff` de `docs/screens/`.

## Quando isso roda

- **Não** entra no portão rápido nem no pesado: a suíte sobe dois servidores e leva minutos, e o
  portão pesado já é chamado no `pre-push` (D-066). Ela é task própria, chamada no encerramento de
  um passo que mexeu em tela ([close-step.md](close-step.md)).
- No GitHub, `e2e.yml` roda a suíte no `main` e nos pull requests que tocam `web/` ou `backend/`,
  só no Chromium e **sem** commitar imagem nenhuma: lá ela vale como teste, não como fotógrafo.

## Quando alguma coisa quebra

| Sintoma | Causa provável |
|---|---|
| `the seed has no ride called "..."` | o manifesto é de uma execução antiga; rode `yarn e2e` de novo |
| a API não sobe em 300s | primeira execução baixando dependências; rode `uv sync` antes |
| toda requisição volta 403 | `DJANGO_CORS_ALLOWED_ORIGINS` não bate com a porta do `vite preview` |
| a sessão não gruda | algum dos dois servidores está em `127.0.0.1` em vez de `localhost` |
| `browserType.launch` falha | falta `yarn playwright install chromium` |
