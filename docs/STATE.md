# Estado do projeto

Atualizado em 2026-09-24.

## Onde estamos

Versão `v0.8.0`: passo 7a (extrator embutido) concluído; o 7b (importação no mural) é o próximo. Antes:
tempo real e PWA (`v0.7.0`), esqueleto (`v0.1.0`),
SSE confirmado pelo túnel e num iPhone (`v0.2.0`, D-076), ritual de encerramento corrigido
(`v0.2.1`), `places` (`v0.3.0`), `accounts` (`v0.4.0`), `rides` (`v0.5.0`) e os ajustes do teste
no celular (`v0.6.0`). API publicada em `api-brazcar.elj-labs.org` e front em
`brazcar.elj-labs.org` ([runbooks/deploy.md](runbooks/deploy.md)), os dois na `v0.7.0` desde
2026-09-23; a `v0.8.0` ainda não foi publicada na máquina.

- `backend/`: uv, Python 3.14, Django 6 ASGI com django-ninja, `config/` como raiz de
  composição, logs JSON, banco por `DATABASE_URL`, ruff `ALL`, pyright strict, teste de
  arquitetura por AST. Em `shared/domain`, `FrozenModel`. Em `shared/application`, as portas
  `Clock`, `Mailer`, `RateLimiter` (D-097), `BoardRevision` e `BoardSignal` (D-098). Em
  `shared/adapters`: app Django `shared` com a linha da revisão e a tabela de hits, o sinal por
  leitura 1x/s, SSE, rota de diagnóstico, CORS, `OriginCheckMiddleware` (D-091), `session_auth`
  e `optional_account_id`, relógio, e-mail e `GET /api/web-version`, o piso de versão do front
  lido de `WEB_MINIMUM_VERSION` (D-105).
- `places` (v0.3.0): `Catalog` é o agregado (D-083), `Place` com `PlaceId` em slug (D-084);
  rotas públicas `GET /api/places?q=` e `/api/places/{id}` (D-086); catálogo em `catalog.toml`
  sincronizado por `manage.py sync_places` no entrypoint (D-087).
- `accounts` (v0.4.0, limites na v0.5.0): `Account` com carros; `AccountId` é o UUID do usuário
  do Django (D-090); rotas em `/api/accounts`; sessão por cookie `brazcar_session`. Login estourado
  responde 429 e recuperação de senha estourada cai em silêncio (D-097).
- `rides` (v0.5.0): `RideOffer` com situação calculada (ADR-0003), regras de edição e atraso
  (ADR-0004), eventos gravados em tabela só de acréscimo na mesma transação (ADR-0005, ADR-0008),
  revisão do mural incrementada junto (ADR-0010). Paradas do catálogo conferidas (D-093), datas
  de volta no fuso do mural (D-094). Rotas em `/api/rides`: mural público com filtros por lugar
  (com descendentes), dia, vagas e preço; `GET /mine`, `GET /{id}`; publicar, editar, vagas,
  cancelar, repetir (só o dono); contato (ADR-0006, D-095); `GET /revision` e `GET /signal` (SSE).
  Read model `RideOut` sem telefone nem placa, com situação e ações prontas (D-096).
- `importing` (v0.8.0, só a metade do extrator; desenho completo em D-108 a D-124, ADR-0015 e
  ADR-0016, spec em `specs/importing/`): `SourceMessage` e `WatchedGroup` no domínio; porta
  `SourceMessages` e caso de uso `PurgeSourceMessages`; `DjangoStore` como `MessageWriter` do extrator
  (`whatsapp-extractor` v0.2.1 por git), gravando só texto de grupo observado, de outra pessoa, com
  telefone (D-111); `run_extractor` com o laço de D-112, `pair_whatsapp`, `list_whatsapp_groups`,
  `install_purge_schedule` (job do `pg_cron`) e `source_messages` (inspeção, D-124). Contratos em
  `tests/contracts/source_messages.py` e o da poda (SQL do job = caso de uso) só no Postgres.
  `infra/postgres`: imagem oficial mais `pg_cron`, publicada pelo fluxo `image`; `whatsapp-role.sql`
  cria o papel e o schema de D-040. `infra/compose.yml` ganhou o serviço `worker`.
- Contratos de porta em `backend/tests/contracts/` (D-085): `CatalogRepository`,
  `AccountRepository`, `RideRepository` e `RateLimiter`, cada um no fake, em SQLite e no Postgres
  do compose (`poe test-postgres`).
- `web/`: yarn 4, Vite, React 19, TypeScript strict, Tailwind v4, TanStack Router e Query, Base UI
  (D-088). `features/rides` em quatro camadas: gateway e fonte do sinal (sobre
  `resilient-event-source`) em `adapters`; hooks `useBoard`, `useBoardSignal`, `useRide`,
  `useMyRides`, `usePublishRide`, `useContact`, `useRouteDraft` e `useForgetBoardOffline` em `app`
  (todos com teste, menos `useRide` e `useMyRides`); cards, filtros,
  formulário, detalhe e botão de contato em `ui`. Rotas `/` (mural, filtros na URL),
  `/caronas/$rideId`, `/caronas/$rideId/editar`, `/publicar`, `/minhas-caronas`. Primitivos novos
  em `shared/ui`: `Badge`, `Card`, `SelectField`, `ConfirmDialog`; `PageShell` ganhou `actions`.
- PWA (v0.7.0, D-106): `vite-plugin-pwa` em modo `prompt`, manifesto e ícones provisórios, precache
  só da casca. Em `shared`: adaptadores de service worker, rede, modo de exibição, versão do build e
  piso; hooks `useAppUpdate`, `useVersionFloor`, `useNetworkStatus`, `useInstallHint` e
  `useUnsavedWork` (o formulário de carona se marca); primitivos `NoticeScreen`, `NoticeBar`,
  `AppFooter`. A raiz mostra "Sem internet" por cima da página montada, a tela de atualização
  obrigatória abaixo do piso, o aviso de build novo e a dica de "Adicionar à Tela de Início" no
  iPhone. A versão do build fica no rodapé; o `scripts/release.sh` acompanha o `web/package.json`.
- Tempo real (D-104, D-107): rajada ao acordar vale uma busca, qualquer que seja o sorteio; busca
  ao focar e ao voltar a rede é explícita; ao reconectar o primeiro quadro do stream é a comparação
  de revisão; vigia de silêncio do mural em 35s.
- Cobertura: medida só nos fluxos do GitHub, depois do portão rápido. Backend com
  `pytest-cov` (`poe coverage`, piso 92% sobre `src/brazcar`) e front com `@vitest/coverage-v8`
  (`yarn coverage`, piso 52% sobre `domain` e `app`). Resumo no log, nada para fora (D-008).

**Verificado de verdade no passo 7a:** portão rápido (276 testes) e o contrato no Postgres do
compose (26), inclusive o da poda. Na máquina local: extrator e neonize importam e abrem sessão em
Python 3.14 no Windows e, dentro da imagem da API, em Linux 3.14.7 (a imagem precisou de `git` no
build e `libmagic1` no runtime); o CI do repo do extrator também passa em 3.13 e 3.14 (run
35934801089 de lá). No Postgres de dev, reconstruído com a imagem de `infra/postgres`: o papel de
D-040 fez o neonize criar as 17 tabelas `whatsmeow_*` no schema `whatsapp`, nenhuma em `public`;
`install_purge_schedule` criou o job e o `pg_cron` o executou sozinho (`succeeded`, `DELETE 0`);
os comandos do worker recusam com mensagem clara a falta de grupos, de conta e de pareamento.

**Não verificado:** tudo o que exige a máquina de teste e o telefone: pareamento real, mensagens
reais chegando na tabela, restart do worker, o job do `pg_cron` em produção, o pull das duas
imagens do GHCR. É o passo T8 da spec, depois do push da tag e com ok em cada passo. Ainda de
passos anteriores: o mural atualizando sozinho ao voltar do segundo plano no app instalado, o
aviso de build novo e a tela de piso num iPhone, o vigia de 35s em produção, ícone maskable no
Android, a página de edição com adiamento depois da partida, `login` e `password-reset` estourados
pelo navegador, e-mail de verdade pelo Resend.

**Pendências de design (D-103), para a etapa de design:** ícones provisórios (quadrado azul com
círculo branco); o aviso de build novo e a dica de instalação são uma faixa simples sob a barra; a
tela "Sem internet" e a de atualização obrigatória são texto puro; o rodapé com a versão é texto
pequeno sem tratamento; cores do manifesto são as do `--color-surface` provisório.

## Próximo passo

1. Publicar a `v0.8.0` na máquina (T8 da spec, [runbooks/deploy.md](runbooks/deploy.md)): papel de
   D-040, env, pareamento com o número pessoal (D-110), lista de grupos aprovada, `up -d`, mensagens
   reais na tabela. Depois, um commit `docs:` registrando o deploy.
2. Passo 7b (T10 a T19 da spec): `rides` com motorista e origem como tipos-soma, catálogo com os
   bairros, `importing` com candidata, parser Ollama e regras, golden set, front com o selo.
3. Etapa de design do produto (D-103), só com ordem do Eduardo.

## Pendências abertas

- Texto dos termos de uso e de privacidade ainda não foi escrito (D-033); o cadastro já grava o
  aceite e a tela já mostra a frase, sem link.
- Recuperação manual de senha para conta sem e-mail depende de admin, que só entra somente
  leitura (D-087); até lá não há caminho.
- O `Catalog` é carregado inteiro a cada requisição de `places` e a cada listagem do mural
  (`labels`); cachear por revisão se pesar.
- A normalização de texto existe duas vezes: `places/domain/search_key.py` e `search/domain/text.py`.
  A busca de lugares pode passar a usar o índice de `search` quando houver um terceiro uso.
- O índice de busca é alimentado depois da gravação, fora da transação: se a indexação falhar, a
  carona fica no mural mas não aparece na busca por texto até o próximo `index_rides`.
- A tabela de hits do limite cresce com o uso e só é podada por chave; um comando de limpeza
  entra se pesar.
- Rota `/api/diagnostics/sse`, página `/diagnostics` e `SSE_DIAGNOSTICS_TOKEN` ficam de propósito
  (D-107), como semente de uma telemetria própria, também do aparelho; a página não tem link na
  interface.
- Ao voltar do segundo plano com mudança no meio, o mural pode buscar duas vezes (foco e sinal):
  escolha registrada em D-104, não defeito.
- Teto de descritores do container da API não foi conferido.
- O extrator traz SQLAlchemy, Alembic, typer e tomlkit como dependências transitivas que o BrazCar não
  usa; tirá-las é assunto do repo dele (D-041).
- A imagem da API cresceu com `git` no build e `libmagic1` no runtime, exigências do extrator.
- O worker usa o número pessoal do Eduardo (D-110) até haver chip dedicado.
- Sobrou uma pasta `.whatsapp_scrapping_wip/proj1/.pytest_cache` com permissão negada no
  Windows. Remover manualmente como administrador. Está no `.gitignore`.
