# Estado do projeto

Atualizado em 2026-09-22.

## Onde estamos

Versão `v0.3.0`: passo 3 concluído, o contexto `places`, o primeiro com regra de negócio e o
molde que `accounts` e `rides` vão copiar. Antes dele: esqueleto (`v0.1.0`), SSE confirmado pelo
túnel e num iPhone (`v0.2.0`, D-076) e o ritual de encerramento corrigido (`v0.2.1`). API
publicada em `api-brazcar.elj-labs.org` e front em `brazcar.elj-labs.org`
([runbooks/deploy.md](runbooks/deploy.md)); **o `v0.3.0` ainda não foi publicado na máquina de
teste**. Ainda não há autenticação.

- `backend/`: uv, Python 3.14, Django 6 ASGI com django-ninja, `config/` como raiz de
  composição, logs JSON, banco por `DATABASE_URL`, ruff `ALL`, pyright strict, teste de
  arquitetura por AST. Em `shared/domain`, `FrozenModel` (congelado, `extra="forbid"`, `evolve()`
  revalida). Em `shared/adapters`: quadros e resposta SSE, rota de diagnóstico por token, CORS.
- `places`: `Catalog` é o agregado (D-083), `Place` com `PlaceId` em slug (D-084), `PlaceKind`,
  apelidos, lugar pai e `geometry` vazio; `SearchKey` é a única definição de "mesmo texto".
  Casos de uso `SearchPlaces`, `ResolvePlace` e `SyncCatalog`; porta `CatalogRepository`;
  adaptador Django que grava o agregado inteiro em `atomic` por `sync_to_async`; rotas públicas
  `GET /api/places?q=` e `GET /api/places/{id}` com schema de saída próprio (D-086); catálogo em
  `catalog.toml` sincronizado por `manage.py sync_places`, que roda no entrypoint (D-087).
- Contrato de porta em `backend/tests/contracts/`, herdado pelo fake e pelo adaptador Django
  (D-085). `poe test` roda em SQLite; `poe test-postgres`, dentro de `poe check-heavy`, repete os
  `contract` no Postgres do compose, com `EXPECT_DB_VENDOR` para não passar no banco errado.
- `contract/openapi.json` e os tipos do front regerados com as rotas de `places`.
- `web/`: yarn 4, Vite, React 19, TypeScript strict, Tailwind v4, TanStack Router e Query, Base UI
  como biblioteca headless (D-088). Em `features/places`: tipos de domínio próprios, adaptador
  HTTP, hook `usePlaceSearch` (testado com Testing Library e jsdom) e `PlacePicker` sobre o
  primitivo `shared/ui/combobox`. A tela inicial mostra o status da API e o seletor.
- Hooks em `.githooks/`, GitHub Actions com o portão rápido, `compose.yml` de desenvolvimento
  com Postgres opcional e `infra/compose.yml` de deploy.

**Verificado de verdade neste passo:** portão rápido do backend (119 testes, com Hypothesis nas
propriedades de hierarquia, apelido e busca) e do front (9 testes, build); o contrato de
`CatalogRepository` no fake, em SQLite e no Postgres 18 do compose (na porta 5433; a 5432 é de
outro projeto), duas vezes; o portão `EXPECT_DB_VENDOR` recusando SQLite quando se pede Postgres;
`sync_places` num banco local, duas vezes, a segunda "already up to date"; o seletor no Chrome
contra a API local: lista completa com o campo vazio, "rodo" achando "Rodoviária do Plano",
"nenhum lugar" para texto sem resultado, seleção por teclado subindo para a página.

**Não verificado:** o `check-heavy` inteiro numa tacada só (o Docker Desktop estava pausado na
última rodada; as partes passaram em separado); o seletor num iPhone ou em tela de toque; a
imagem da API com o `sync_places` no entrypoint; tamanho de bundle do Base UI.

Do passo 2, continua valendo o que foi conferido e o que não foi: ver
[decisions/0013](decisions/0013-sse-through-tunnel-verdict.md).

## Próximo passo

1. `accounts`: usuário customizado antes da primeira migration de auth (D-028), cadastro por
   telefone, sessão por cookie (D-059), carros. Copiar o molde de `places`: agregado, porta,
   contrato herdado em `tests/contracts/`, schema de saída próprio, comandos onde couber.
2. `rides`, referenciando lugar por `PlaceId` e usando `ResolvePlace` para o filtro por descendentes.
3. Tempo real: o adaptador SSE de verdade, seguindo D-077.
4. Front e PWA.

## Pendências abertas

- Publicar `v0.3.0` na máquina de teste e conferir o `sync_places` rodando no entrypoint.
- O `Catalog` é carregado inteiro a cada requisição de `places` (duas consultas). Bastou para
  dezenas de lugares; se o catálogo crescer ou a rota pesar, cachear por revisão (D-083).
- Admin do Django: só depois de `accounts`, e somente leitura (D-087).
- De D-059 já existe o CORS com credenciais por ambiente (D-079). Cookie de sessão e checagem de
  `Origin` entram com a sessão, no contexto `accounts`.
- Rota `/api/diagnostics/sse` e página `/diagnostics` seguem ligadas de propósito: falta repetir
  a medição com o app instalado na tela de início (`standalone`), o que só faz sentido quando o
  PWA existir. Depois disso, remover rota, página e `SSE_DIAGNOSTICS_TOKEN`.
- Teto de descritores do container da API não foi conferido; é o primeiro limite real para
  centenas de conexões SSE simultâneas.
- Falta provar o extrator rodando em Python 3.14 quando ele for embutido; se falhar, o recuo é
  para 3.13 (D-070).
- D-040 está como proposto: falta testar se um usuário de banco com `search_path` fixo isola as
  tabelas `whatsmeow_*` sem tocar na URL nem no código Go. Só importa quando o extrator entrar.
- Sobrou uma pasta `.whatsapp_scrapping_wip/proj1/.pytest_cache` com permissão negada no
  Windows. Remover manualmente como administrador. Está no `.gitignore`.
- Texto dos termos de uso e de privacidade ainda não foi escrito (D-033).

## Em voo

Nada.
