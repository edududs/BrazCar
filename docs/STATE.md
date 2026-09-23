# Estado do projeto

Atualizado em 2026-09-23.

## Onde estamos

Versão `v0.7.0`: passo 6 (tempo real de verdade e PWA) concluído. Antes dele: esqueleto (`v0.1.0`),
SSE confirmado pelo túnel e num iPhone (`v0.2.0`, D-076), ritual de encerramento corrigido
(`v0.2.1`), `places` (`v0.3.0`), `accounts` (`v0.4.0`), `rides` (`v0.5.0`) e os ajustes do teste
no celular (`v0.6.0`). API publicada em `api-brazcar.elj-labs.org` e front em
`brazcar.elj-labs.org` ([runbooks/deploy.md](runbooks/deploy.md)). O front do passo 6 já está no
Vercel desde 2026-09-23 (push intermediário, sem tag); a API segue na `0.6.0` até o deploy da
imagem `0.7.0`.

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

**Verificado de verdade no passo 6:** portão rápido dos dois lados (248 testes no backend, 56 no
front) e o pesado do front (build com 47 entradas de precache e nada de `/api`). No Chrome, contra a
API local e o `vite preview`: service worker controlando a página e servindo deep link pela casca;
"Sem internet" com a página montada e o mural rebuscado do zero ao voltar; build novo mostrou o
aviso, "Atualizar" com o formulário de publicar aberto pediu confirmação e trocou de versão; com
`WEB_MINIMUM_VERSION=0.7.0` a versão velha caiu na tela obrigatória e "Atualizar" achou o build
novo, trocou e liberou. A API de produção `0.6.0`, sem a rota do piso, responde 404 com CORS e o
front trata como sem piso. Num iPhone, com o app instalado pelo front publicado: dica de instalação,
barras, notch e rodapé sem problema, e a medição do sinal em `standalone` (ADR-0014): o adaptador
cobriu bloqueio de 40s, 2 e 10 min, troca de app e troca de rede sem mudança; a troca de rede pela
Central de Controle só é notada pelo vigia, que caiu para 35s.

**Não verificado:** o mural atualizando sozinho ao voltar do segundo plano no app instalado (o
diagnóstico mede o stream, não a busca); o aviso de build novo e a tela de piso num iPhone (só no
Chrome); o vigia de 35s em produção; ícone maskable no Android. Ainda de passos anteriores: a página
de edição com adiamento depois da partida, `login` e `password-reset` estourados pelo navegador,
e-mail de verdade pelo Resend, e no celular a conta com carro opcional, a carona A→B e o "passa por"
achando parada em texto livre (ajustes da `v0.6.0`).

**Pendências de design (D-103), para a etapa de design:** ícones provisórios (quadrado azul com
círculo branco); o aviso de build novo e a dica de instalação são uma faixa simples sob a barra; a
tela "Sem internet" e a de atualização obrigatória são texto puro; o rodapé com a versão é texto
pequeno sem tratamento; cores do manifesto são as do `--color-surface` provisório.

## Próximo passo

1. Publicar a API `0.7.0` pelo runbook de deploy (a rota do piso) e conferir `GET /api/web-version`.
2. Conferir no celular o que ficou sem cobrir: o mural atualizando sozinho ao voltar do segundo
   plano no app instalado, e o aviso de build novo quando sair a próxima versão.
3. Etapa de design do produto (D-103), só com ordem do Eduardo. Depois dela, o extrator.

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
- Falta provar o extrator rodando em Python 3.14 quando ele for embutido (D-070).
- D-040 está como proposto; só importa quando o extrator entrar.
- Sobrou uma pasta `.whatsapp_scrapping_wip/proj1/.pytest_cache` com permissão negada no
  Windows. Remover manualmente como administrador. Está no `.gitignore`.
