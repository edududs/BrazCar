# Estado do projeto

Atualizado em 2026-09-22.

## Onde estamos

Versão `v0.5.0`: passo 5 (`rides`) concluído. Antes dele: esqueleto (`v0.1.0`), SSE confirmado
pelo túnel e num iPhone (`v0.2.0`, D-076), ritual de encerramento corrigido (`v0.2.1`), `places`
(`v0.3.0`) e `accounts` (`v0.4.0`). API publicada em `api-brazcar.elj-labs.org` e front em
`brazcar.elj-labs.org` ([runbooks/deploy.md](runbooks/deploy.md)), os dois na `v0.5.0` desde
2026-09-22.

- `backend/`: uv, Python 3.14, Django 6 ASGI com django-ninja, `config/` como raiz de
  composição, logs JSON, banco por `DATABASE_URL`, ruff `ALL`, pyright strict, teste de
  arquitetura por AST. Em `shared/domain`, `FrozenModel`. Em `shared/application`, as portas
  `Clock`, `Mailer`, `RateLimiter` (D-097), `BoardRevision` e `BoardSignal` (D-098). Em
  `shared/adapters`: app Django `shared` com a linha da revisão e a tabela de hits, o sinal por
  leitura 1x/s, SSE, rota de diagnóstico, CORS, `OriginCheckMiddleware` (D-091), `session_auth`
  e `optional_account_id`, relógio e e-mail.
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
- Contratos de porta em `backend/tests/contracts/` (D-085): `CatalogRepository`,
  `AccountRepository`, `RideRepository` e `RateLimiter`, cada um no fake, em SQLite e no Postgres
  do compose (`poe test-postgres`).
- `web/`: yarn 4, Vite, React 19, TypeScript strict, Tailwind v4, TanStack Router e Query, Base UI
  (D-088). `features/rides` em quatro camadas: gateway e fonte do sinal (sobre
  `resilient-event-source`) em `adapters`; hooks `useBoard`, `useBoardSignal`, `useRide`,
  `usePublishRide`, `useContact`, `useMyRides` em `app` (três com teste); cards, filtros,
  formulário, detalhe e botão de contato em `ui`. Rotas `/` (mural, filtros na URL),
  `/caronas/$rideId`, `/caronas/$rideId/editar`, `/publicar`, `/minhas-caronas`. Primitivos novos
  em `shared/ui`: `Badge`, `Card`, `SelectField`, `ConfirmDialog`; `PageShell` ganhou `actions`.

**Verificado de verdade no passo 5:** portão rápido dos dois lados (228 testes no backend, 19 no
front); contratos de `RideRepository` e `RateLimiter` no fake, em SQLite e no Postgres 18 do
compose; rotas de `rides` contra a composição real (publicar exige sessão, carro e lugar do
catálogo; card sem placa nem telefone; filtros por lugar-pai, dia, vagas e preço; vagas zero
lota e voltar reabre; cancelada é definitiva e repetir cria outra; horário de outro dia recusado
com 409; só o dono mexe; contato dá link `wa.me` e placa, 429 no 21º pedido, 409 em carona
lotada; a revisão sobe uma vez por escrita; o stream do sinal abre com `retry` e a revisão atual);
no Chrome contra a API local: cadastro → carro → publicar (parada do catálogo pelo combobox e
parada "outro" em texto) → detalhe com ações do dono → vagas 3→0 ("lotada") → 1 ("reaberta") →
editar preço → segunda conta pede contato e recebe placa e link `wa.me` com a mensagem pronta →
mural filtrado por Plano Piloto lista a carona da Esplanada e **atualizou sozinho pelo sinal** ao
publicar outra por curl → diálogo de cancelar (Base UI) → repetir cria a carona do dia seguinte →
"minhas caronas" lista as quatro, da mais recente para a mais antiga. A carona das 16:00 virou
"já saiu" sozinha depois da tolerância.

Publicado e conferido: a imagem `0.5.0` na máquina de teste aplicou as migrations `rides` e
`shared` no Postgres de lá; pelo túnel, `/api/rides` responde, `/mine` dá 401 sem sessão,
`Origin` estranho dá 403 e `/api/rides/signal` entrega o quadro de revisão na hora, sem buffer.
No Chrome, com o mural do Vercel aberto, uma carona publicada pela API **apareceu sozinha** e,
cancelada, **sumiu sozinha**: o sinal atravessa o Cloudflare e invalida a lista. A conta de
teste foi apagada pela própria API e o mural de produção ficou vazio.

**Não verificado:** o sinal e a invalidação num iPhone; a página de
edição com adiamento depois da partida (só o domínio e a rota cobrem); `login` e
`password-reset` com limite estourado pelo navegador (só o caso de uso e a rota); e-mail de
verdade pelo Resend.
No Vite em desenvolvimento a otimização de dependências recarregou a página duas vezes no meio
de um formulário e abortou a resposta de um login (o cookie não chegou); não acontece no build.
Durante o teste havia outro Vite antigo na 5173; o novo subiu na 5175, e a API precisa das duas
origens em `DJANGO_CORS_ALLOWED_ORIGINS` ou a checagem de `Origin` devolve 403.

## Ajustes depois do teste no celular (a publicar)

Pedidos do Eduardo em 2026-09-22, feitos e conferidos localmente, ainda **sem versão nem deploy**:
rota como "Sai de", "Vai para" e paradas no caminho opcionais (D-099); busca como contexto próprio
`search` (D-100) e filtro "passa por" em texto livre que acha também paradas "outro" (D-101);
barra de navegação em todas as páginas e conta com carro opcional e fechado (D-102). Verificado:
portão rápido dos dois lados, contrato do `SearchIndex` no fake e em SQLite, e no Chrome contra a
API local: conta com a barra, carona A→B com destino em texto livre, parada no caminho entrando
antes do destino, e o mural filtrado por "setor o ceilandia" achando só essa carona.

## Próximo passo

1. Conferir num iPhone, em `brazcar.elj-labs.org`: cadastro, publicar, contato e o mural
   atualizando sozinho, inclusive depois de voltar do segundo plano.
2. Passo 6, tempo real de verdade: o que falta de ADR-0010 e D-077 no front (heartbeat vigiado,
   reconexão ao voltar ao foco já vêm do adaptador; medir no app instalado), `LISTEN/NOTIFY` só se
   o segundo de atraso incomodar (D-050).
3. Front e PWA: manifesto, service worker em modo `prompt`, tela offline, safe-area.

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
- Rota `/api/diagnostics/sse` e página `/diagnostics` seguem ligadas de propósito até a medição
  com o app instalado (`standalone`). Depois disso, remover rota, página e `SSE_DIAGNOSTICS_TOKEN`.
- Teto de descritores do container da API não foi conferido.
- Falta provar o extrator rodando em Python 3.14 quando ele for embutido (D-070).
- D-040 está como proposto; só importa quando o extrator entrar.
- Sobrou uma pasta `.whatsapp_scrapping_wip/proj1/.pytest_cache` com permissão negada no
  Windows. Remover manualmente como administrador. Está no `.gitignore`.
