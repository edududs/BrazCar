# Estado do projeto

Atualizado em 2026-09-21.

## Onde estamos

Versão `v0.2.1`: passos 1 e 2 concluídos, mais a correção do ritual de encerramento (portão pesado
como task nomeada, versão única entre pacote, API e contrato). O esqueleto existe (tag `v0.1.0`), os dois portões
passam, e o teste de risco (tag `v0.2.0`) deu **SSE confirmado** pelo túnel e num iPhone (D-076, números em
[decisions/0013](decisions/0013-sse-through-tunnel-verdict.md)). API publicada em
`api-brazcar.elj-labs.org` e front em `brazcar.elj-labs.org`
([runbooks/deploy.md](runbooks/deploy.md)). Ainda não há regra de negócio, model nem autenticação.

- `backend/`: uv, Python 3.14, Django 6 ASGI com django-ninja, pacotes `rides`, `accounts`,
  `places` vazios com as três camadas, `config/` como raiz de composição, endpoint
  `GET /api/health`, logs JSON na saída padrão (inclusive os do uvicorn) e banco por `DATABASE_URL`.
  Em `shared/adapters`: quadros e resposta SSE (`sse.py`), a rota de diagnóstico protegida por
  token e CORS por ambiente. Imagem da API (`backend/Dockerfile`) com migração no entrypoint.
  ruff `ALL`, pyright strict e poe em arquivos próprios. Teste de arquitetura por AST.
- `contract/openapi.json`: exportado pelo comando `export_openapi_schema` do próprio ninja
  (`uv run poe openapi`). Um teste falha se o arquivo divergir do código, e `yarn gen:api --check`
  falha se os tipos do front divergirem do arquivo.
- `web/`: yarn 4, Vite, React 19, TypeScript strict, Tailwind v4, eslint `strictTypeChecked`,
  prettier, TanStack Router e Query, pastas por funcionalidade com as quatro camadas, uma tela
  que mostra se a API está no ar, o adaptador `resilient-event-source` (embrião do sinal do mural)
  e a página `/diagnostics`. O eslint proíbe tipos gerados e cliente HTTP fora de `adapters/`.
- Hooks em `.githooks/` (`pre-commit` rápido, `pre-push` pesado, que chama `poe check-heavy` e `yarn run check:heavy`), GitHub Actions com o portão
  rápido por caminho e os fluxos `image` e `release` disparados por tag, `.env.example`,
  `compose.yml` de desenvolvimento com Postgres opcional e `infra/compose.yml` de deploy.

Conferido em execução, além dos portões: Postgres 18 do `compose.yml` saudável, com o volume em
`/var/lib/postgresql`, e o Django conectando nele por `DATABASE_URL` (checagem, consulta e a suíte
inteira); a tela de status num navegador, com a API no ar e fora do ar. A checagem de links da
documentação entrou no portão rápido, e mudança em `docs/` ou em qualquer `.md` dispara o portão
do backend. Nesta máquina a porta 5432 já é de outro projeto: use `POSTGRES_PORT`.

Do passo 2, conferido de verdade: entrega, atraso, corte de conexão ociosa, 40 min com batimento
e custo de 100 conexões pelo caminho real (Cloudflare, túnel, Traefik, API); HTTP/2 na borda por
ALPN; CORS pela origem real; o roteiro num iPhone em Safari, Wi-Fi e 4G; a imagem com migração,
healthcheck e parada em 1s; a página `/diagnostics` no Chrome contra a API local. **Não
conferido:** o app instalado na tela de início (`standalone`); HTTP/2 visto de dentro do Safari;
a correção de reconexão imediata (`dead-on-resume`) num iPhone, que só passou pelos portões; o teto
de descritores do container.

Publicado em `github.com/edududs/BrazCar` (o `main` antigo, de 2025, foi sobrescrito). Os fluxos
`backend` e `web` do GitHub passaram num clone limpo em Linux e aceitam disparo manual.

## Próximo passo

1. Contextos, nesta ordem: `places`, `accounts`, `rides`.
2. Tempo real: o adaptador SSE de verdade, seguindo D-077.
3. Front e PWA.

## Pendências abertas

- De D-059 já existe o CORS com credenciais por ambiente (D-079). Cookie de sessão e checagem de
  `Origin` entram com a sessão, no contexto `accounts`.
- Rota `/api/diagnostics/sse` e página `/diagnostics` seguem ligadas de propósito: falta repetir
  a medição com o app instalado na tela de início (`standalone`), o que só faz sentido quando o
  PWA existir. Depois disso, remover rota, página e `SSE_DIAGNOSTICS_TOKEN`.
- Teto de descritores do container da API não foi conferido; é o primeiro limite real para
  centenas de conexões SSE simultâneas.
- Falta provar o extrator rodando em Python 3.14 quando ele for embutido; se falhar, o recuo é
  para 3.13 (D-070).
- O front tem poucos testes: só a lógica de tempo do stream (`stream-timing`) está coberta.
- D-040 está como proposto: falta testar se um usuário de banco com `search_path` fixo isola as
  tabelas `whatsmeow_*` sem tocar na URL nem no código Go. Só importa quando o extrator entrar.
- Sobrou uma pasta `.whatsapp_scrapping_wip/proj1/.pytest_cache` com permissão negada no
  Windows. Remover manualmente como administrador. Está no `.gitignore`.
- Texto dos termos de uso e de privacidade ainda não foi escrito (D-033).

## Em voo

Nada.
