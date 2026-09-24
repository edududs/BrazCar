# Estado do projeto

Atualizado em 2026-09-24.

## Onde estamos

Versão `v0.11.0`: passo curto de observações e preço por parada concluído no repo. Antes:
`v0.10.0` (reprocessamento manual e rota de até 15 paradas), `v0.9.0` (passo 7b, importação no
mural), extrator embutido (`v0.8.0`), tempo real e PWA (`v0.7.0`), esqueleto (`v0.1.0`),
SSE confirmado pelo túnel e num iPhone (`v0.2.0`, D-076), ritual de encerramento corrigido
(`v0.2.1`), `places` (`v0.3.0`), `accounts` (`v0.4.0`), `rides` (`v0.5.0`) e os ajustes do teste
no celular (`v0.6.0`). API publicada em `api-brazcar.elj-labs.org` e front em
`brazcar.elj-labs.org` ([runbooks/deploy.md](runbooks/deploy.md)), os dois na `v0.7.0` desde
2026-09-23; a API e o worker na `v0.9.0` desde 2026-09-24.

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
- `rides` (v0.11.0): `RideOffer.notes` é texto livre opcional de até 500 caracteres, em publicar,
  editar e repetir, recusado (422) quando parece telefone, e-mail ou placa, pelo detector de
  `shared/domain/personal_data.py` (D-129); `Stop.fare` é o preço de chegar até aquela parada, e
  com alguma tarifa o `price` da carona é a menor delas, calculado por `price_from` (D-131). O
  read model leva `notes`, a tarifa de cada parada e `has_fares`, para a tela só desenhar. Migração
  `rides.0003`, aditiva. A busca "passa por" continua lendo só as paradas.
- `rides` (v0.9.0): `RideOffer.driver` é tipo-soma `RegisteredDriver` (conta e carro, carro
  opcional só na importada) ou `ExternalDriver` (telefone e nome do WhatsApp); `origin` é `Published`
  ou `WhatsApp` com o texto original redigido (ADR-0015, D-127, D-128). `ImportRide` (conta pelo
  telefone ou externo; junção por partida) e `ForgetRides`; contato sem placa para externo; `RideOut`
  com `car` opcional, `origin` e `origin_message`; tolerância 10 min (D-121).
- `importing` (v0.9.0; desenho em D-108 a D-129, ADR-0015 e ADR-0016; glossário em
  [domain/importing.md](domain/importing.md)): mensagem-fonte, candidata com veredito, julgamento
  (`Offer`, `Request`, `Update`, `Other`), conferências e confiança, `resolve_departure`, `decide`;
  casos de uso `IngestMessages`, `JudgeCandidates`, `PurgeImported`, `BlockSender`; adaptadores
  Django, `OllamaRideParser` (JSON schema de `ParserOutput`, pensamento desligado, `httpx` só ali),
  `CatalogStopResolver`, `RidesBridge`; poda em SQL para o `pg_cron` provada igual ao caso de uso por
  contrato; comandos `import_rides`, `candidates`, `block_sender`. Golden set de 120 mensagens reais
  anonimizadas e as medições por modelo em [parser-models.md](parser-models.md): `qwen3.5:4b` é o
  padrão. Catálogo com os bairros de Brazlândia e pontos de Brasília (D-122). Detector de dados
  pessoais em `shared/domain/personal_data.py`.
- `importing` (v0.11.0): o interpretador devolve pares parada e valor (`StopFare`, `OfferFare`) e
  `attach_fares` decide, em código, a qual parada cada par pertence; par que não nomeia uma parada
  só, que cai na parada de saída ou cujo valor não está na mensagem é descartado (D-131). A
  candidata aceita carrega as tarifas e o rascunho custa a menor delas. Os pesos da confiança não
  mudaram e a importação continua sem preencher `notes` (D-129).
- `web/` (v0.9.0): card com selo "via WhatsApp" e carro opcional, detalhe com a mensagem original,
  contato sem placa; primeiros testes de componente (`ride-card`, `ride-detail`, `contact-button`)
  sobre um harness com roteador em `shared/testing/`.
- `web/` (v0.11.0): formulário com caixa de observações e contador de 500, e campo de preço em cada
  parada menos a primeira; com alguma tarifa o campo de preço da carona some, porque quem decide é
  a API. Card com as observações numa linha cortada e "a partir de" quando a API marca `has_fares`;
  detalhe com as observações inteiras e a tarifa ao lado de cada parada. Primitivo novo
  `TextAreaField` em `shared/ui`. Testes de componente de `ride-form`, e de `ride-changes` e
  `useRouteDraft` no headless (D-126).
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
- Cobertura: medida só nos fluxos do GitHub, depois do portão rápido. Backend com `pytest-cov`
  (`poe coverage`), 88,58% medidos sobre `src/brazcar` e piso de 87%; front com `@vitest/coverage-v8`
  (`yarn coverage`), piso de 15%, com meta de paridade (D-126). O resumo
  fica no log do passo e nada é enviado para serviço de terceiros (D-008).
- Portões (D-132): o `pre-push` saiu, nenhum hook roda teste no push. O GitHub roda o portão
  pesado (Postgres como serviço do runner, build do front); localmente ele é ato explícito do
  ritual de encerramento. Um hook `commit-msg` recusa assunto fora do Conventional Commits e
  trailer ou menção a ferramenta de IA.

**Verificado de verdade no passo 7b:** portão rápido (343 testes no backend, 63 no front, com os
primeiros de componente) e portão pesado dos dois lados, com 31 contratos no Postgres do compose,
entre eles o que prova que a poda em SQL do `pg_cron` e o caso de uso apagam as mesmas linhas.
Golden set medido no notebook (RTX 4050): `qwen3.5:4b` tipo 95%, campos 92%, mediana 1,3 s;
`qwen2.5:7b-instruct` 91%, 93%, 3,1 s; `qwen2.5:3b-instruct` reprovado no dia. Na máquina de teste,
pelo túnel: `qwen3.5:4b` 94%, 91%, mediana 4,3 s; `gemma3:4b` 92%, 83%, 4,0 s (tabela completa em
[parser-models.md](parser-models.md)); o container do worker alcança o Ollama por `host.docker.internal`.

Publicado e conferido em 2026-09-24: imagens `0.9.0` no GHCR e na máquina, migrações `importing.0002`
e `rides.0002` aplicadas, 43 lugares no catálogo, job de poda reinstalado com a regra inteira, worker
autenticado e julgando com o `qwen3.5:4b` da máquina. A primeira varredura tomou 7 mensagens em 4
candidatas (uma repostada em 3 grupos, outra em 2) e criou 3 caronas; a quarta foi rejeitada como
não oferta. As 3 aparecem no mural público pela API, sem carro, sem ação de dono e sem telefone no
payload.

**Verificado de verdade no passo das observações e do preço por parada:** portão rápido (373 testes
no backend, 75 no front) e portão pesado dos dois lados, com os 31 contratos no Postgres do compose.
Cobertura do backend em 88,58%, acima do piso de 87%. Pelas rotas, com o banco de verdade:
observações escritas, reescritas, apagadas e fora da busca "passa por"; telefone, e-mail e placa
recusados com 422 e a frase do botão de contato; tarifa por parada precificando a carona pela menor
delas, ignorando o preço digitado, entrando no filtro de preço máximo e sobrevivendo ao repetir;
tarifa na primeira parada recusada. No front, por teste de componente: o contador de 500, o campo de
preço sumindo quando uma parada tem tarifa, o "a partir de" no card e as tarifas ao lado das paradas
no detalhe.

**Não verificado:** a cobertura do front nesta máquina (`@vitest/coverage-v8` não está instalado
aqui; roda no fluxo do GitHub); o interpretador lendo preços por parada contra um Ollama de verdade
(o golden set não mede `fares`, e as 120 mensagens não trazem o julgamento esperado desse campo);
as telas novas num celular. Ainda de antes: o front publicado mostrando o selo e a mensagem
original, no celular; o job do `pg_cron` apagando uma carona importada que partiu; o worker
sobrevivendo a panic do Go ou a reinício do Postgres; o mural atualizando sozinho ao voltar do
segundo plano no app instalado; o aviso de build novo e a tela de piso num iPhone; ícone maskable
no Android; `login` e `password-reset` estourados pelo navegador; e-mail de verdade pelo Resend.

**Pendências de design (D-103), para a etapa de design:** ícones provisórios (quadrado azul com
círculo branco); o aviso de build novo e a dica de instalação são uma faixa simples sob a barra; a
tela "Sem internet" e a de atualização obrigatória são texto puro; o rodapé com a versão é texto
pequeno sem tratamento; cores do manifesto são as do `--color-surface` provisório.

## Próximo passo

1. Conferir no celular as caronas importadas no mural publicado: selo, mensagem original, contato,
   e as telas novas de observações e preço por parada.
2. Medir o interpretador lendo preço por parada contra o Ollama, anotando `fares` no golden set das
   mensagens que trazem lista de preços (as de número 25, 31, 34 e 41).
3. Passo de qualidade (Playwright, Schemathesis, cobertura do front) e a etapa de design (D-103),
   na ordem que o Eduardo decidir.

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
- D-126 diz que o passo de qualidade é o primeiro depois do 7a; o Eduardo decidiu fazer o 7b antes.
  A decisão não foi editada; a ordem real está aqui.
- Tarifa importada que não casa com nenhuma parada (ou casa com mais de uma) é descartada em
  silêncio, e a carona fica com as tarifas que sobraram, ou sem nenhuma. Ninguém vê o descarte; só
  o comando `candidates` mostra o que foi lido. Decidir se vale registrar o descarte em algum lugar.
- A normalização de texto agora existe três vezes (`places`, `search`, `importing`): candidata a
  `shared/domain` no próximo toque em qualquer uma delas.
- Sobrou uma pasta `.whatsapp_scrapping_wip/proj1/.pytest_cache` com permissão negada no
  Windows. Remover manualmente como administrador. Está no `.gitignore`.
