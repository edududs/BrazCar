# Estado do projeto

Atualizado em 2026-09-22.

## Onde estamos

Versão `v0.4.0`: passos 3 (`places`) e 4 (`accounts`) concluídos. Antes deles: esqueleto
(`v0.1.0`), SSE confirmado pelo túnel e num iPhone (`v0.2.0`, D-076) e o ritual de encerramento
corrigido (`v0.2.1`). API publicada em `api-brazcar.elj-labs.org` e front em
`brazcar.elj-labs.org` ([runbooks/deploy.md](runbooks/deploy.md)), os dois na `v0.4.0` desde
2026-09-22. Falta `rides`.

- `backend/`: uv, Python 3.14, Django 6 ASGI com django-ninja, `config/` como raiz de
  composição, logs JSON, banco por `DATABASE_URL`, ruff `ALL`, pyright strict, teste de
  arquitetura por AST. Em `shared/domain`, `FrozenModel` (congelado, `evolve()` revalida). Em
  `shared/application`, as portas `Clock` e `Mailer`. Em `shared/adapters`: SSE, rota de
  diagnóstico, CORS, `OriginCheckMiddleware` (D-091), `session_auth` para o ninja, relógio e
  e-mail sobre o backend do Django.
- `places` (v0.3.0): `Catalog` é o agregado (D-083), `Place` com `PlaceId` em slug (D-084);
  busca sem acento, apelidos e descendentes em memória; rotas públicas `GET /api/places?q=` e
  `/api/places/{id}` (D-086); catálogo em `catalog.toml` sincronizado por `manage.py sync_places`
  no entrypoint (D-087).
- `accounts` (v0.4.0): `Account` com seus carros é o agregado; `PhoneNumber` em E.164 e
  `LicensePlate` como value objects (D-089); `AccountId` é UUID gerado no domínio e chave do
  usuário customizado do Django (D-090), que existe antes da primeira migration de auth (D-028).
  Portas `AccountRepository`, `Credentials` e `PasswordResetTokens`; casos de uso de cadastro,
  login, carros, recuperação de senha (D-092) e exclusão por apagamento no lugar (D-033). Rotas em
  `/api/accounts`: `register`, `login`, `logout`, `me`, `cars`, `password-reset`,
  `password-reset/confirm`, `DELETE me`; sessão por cookie `brazcar_session` httpOnly `Lax`.
- Contratos de porta em `backend/tests/contracts/` (D-085), um por repositório, herdados pelo
  fake e pelo adaptador Django; `poe test-postgres` (parte de `poe check-heavy`) os repete no
  Postgres do compose, lendo `POSTGRES_*` do `.env` da raiz.
- `contract/openapi.json` e os tipos do front regerados com `places` e `accounts`.
- `web/`: yarn 4, Vite, React 19, TypeScript strict, Tailwind v4, TanStack Router e Query, Base UI
  (D-088). `features/places`: `usePlaceSearch` e `PlacePicker`. `features/accounts`: gateway,
  `useSession` (headless, testado), telas `/entrar`, `/cadastro`, `/conta`, `/esqueci-senha` e
  `/redefinir-senha`. Primitivos em `shared/ui`: `Combobox`, `TextField`, `CheckboxField`, `Form`,
  `ActionButton` (com `submit` e `disabled`). O cliente HTTP manda o cookie (`credentials: include`).

**Verificado de verdade no passo 4:** `check-heavy` dos dois lados (172 testes backend, 13 no
front, build); contratos de `CatalogRepository` e `AccountRepository` no fake, em SQLite e no
Postgres 18 do compose; as rotas de `accounts` contra a composição real (sessão, cookie
httpOnly/Lax, `Origin` estranho recusado com 403 mesmo com cookie, placa única, e-mail de
recuperação no `locmem` com link que funciona uma vez, exclusão que libera o telefone); no Chrome
contra a API local: cadastro → `/conta` com o telefone em E.164 → carro adicionado com placa
normalizada → sair → senha errada com o aviso da API → entrar → carro persistido.

Publicado e conferido: a imagem `0.4.0` na máquina de teste aplicou as migrations de auth,
`accounts` e `places` e sincronizou 18 lugares no entrypoint; pelo túnel, `/api/places` responde,
`/me` dá 401 sem cookie e `Origin` estranho dá 403; no Chrome, cadastro pelo front do Vercel
criou a conta na API e **a sessão sobreviveu ao recarregar `/conta`**: o cookie entre as origens
irmãs funciona pelo Cloudflare (ADR-0012). A conta de teste foi apagada pela própria API.

**Não verificado:** e-mail de verdade pelo Resend (sem chave no `api.env`, vai para o log); as
páginas `/esqueci-senha` e `/redefinir-senha` no navegador (só passaram pelos portões); o cookie
num **iPhone** (Safari), que é onde ADR-0012 pode falhar de verdade.
No Vite em desenvolvimento, a primeira visita a uma rota nova recarregou a página no meio do
formulário (otimização de dependências); não acontece no build.

## Próximo passo

1. Conferir cadastro e login num iPhone em `brazcar.elj-labs.org`, e pôr a chave do Resend
   (`EMAIL_*`) no `api.env` da máquina.
2. `rides`: carona com paradas por `PlaceId`, situação calculada (ADR-0003), histórico
   (ADR-0005), contato com limite (ADR-0006, D-064), revisão do mural (ADR-0010). Copiar o
   molde: agregado, porta, contrato em `tests/contracts/`, schema de saída próprio.
3. Tempo real: o adaptador SSE de verdade, seguindo D-077.
4. Front e PWA.

## Pendências abertas

- Texto dos termos de uso e de privacidade ainda não foi escrito (D-033); o cadastro já grava o
  aceite e a tela já mostra a frase, sem link.
- Limite de requisições (D-064) ainda não existe; entra com a rota de contato de `rides`, e
  vale também para `login` e `password-reset`.
- Recuperação manual de senha para conta sem e-mail depende de admin, que só entra somente
  leitura e depois de `rides` (D-087); até lá não há caminho.
- O `Catalog` é carregado inteiro a cada requisição de `places`; cachear por revisão se pesar.
- Rota `/api/diagnostics/sse` e página `/diagnostics` seguem ligadas de propósito até a medição
  com o app instalado (`standalone`). Depois disso, remover rota, página e `SSE_DIAGNOSTICS_TOKEN`.
- Teto de descritores do container da API não foi conferido.
- Falta provar o extrator rodando em Python 3.14 quando ele for embutido (D-070).
- D-040 está como proposto; só importa quando o extrator entrar.
- Sobrou uma pasta `.whatsapp_scrapping_wip/proj1/.pytest_cache` com permissão negada no
  Windows. Remover manualmente como administrador. Está no `.gitignore`.

## Em voo

`rides` começou fora de hora, em 2026-09-22, e parou por ordem do Eduardo. O que existe está
íntegro e passa nos portões, mas **não é um passo fechado**: domínio (`RideOffer`, situação
calculada, regras de edição e atraso, eventos, ações permitidas; 19 testes com Hypothesis) e
aplicação (portas, casos de uso, read model do mural; 7 testes com fakes). Faltam adaptadores
(models, migrations, repositório, contrato nos dois bancos, rotas), o front e o encerramento.
A spec está em `docs/specs/rides/`. Retomar por ali.
