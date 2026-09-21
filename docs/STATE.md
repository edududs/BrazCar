# Estado do projeto

Atualizado em 2026-09-21.

## Onde estamos

Passo 1 concluído e marcado com a tag `v0.1.0`: o esqueleto do repo existe e os dois portões passam. Ainda não há regra de
negócio, model, autenticação nem SSE.

- `backend/`: uv, Python 3.14, Django 6 ASGI com django-ninja, pacotes `rides`, `accounts`,
  `places` e `shared` vazios com as três camadas, `config/` como raiz de composição, endpoint
  `GET /api/health`, logs JSON na saída padrão (inclusive os do uvicorn) e banco por `DATABASE_URL`.
  ruff `ALL`, pyright strict e poe em arquivos próprios. Teste de arquitetura por AST.
- `contract/openapi.json`: exportado pelo comando `export_openapi_schema` do próprio ninja
  (`uv run poe openapi`). Um teste falha se o arquivo divergir do código, e `yarn gen:api --check`
  falha se os tipos do front divergirem do arquivo.
- `web/`: yarn 4, Vite, React 19, TypeScript strict, Tailwind v4, eslint `strictTypeChecked`,
  prettier, TanStack Router e Query, pastas por funcionalidade com as quatro camadas e uma tela
  que mostra se a API está no ar. O eslint proíbe tipos gerados e cliente HTTP fora de `adapters/`.
- Hooks em `.githooks/` (`pre-commit` rápido, `pre-push` pesado), GitHub Actions com o portão
  rápido por caminho, `.env.example` e `compose.yml` de desenvolvimento com Postgres opcional.

Conferido em execução, além dos portões: Postgres 18 do `compose.yml` saudável, com o volume em
`/var/lib/postgresql`, e o Django conectando nele por `DATABASE_URL` (checagem, consulta e a suíte
inteira); a tela de status num navegador, com a API no ar e fora do ar. A checagem de links da
documentação entrou no portão rápido, e mudança em `docs/` ou em qualquer `.md` dispara o portão
do backend. Nesta máquina a porta 5432 já é de outro projeto: use `POSTGRES_PORT`.

Publicado em `github.com/edududs/BrazCar` (o `main` antigo, de 2025, foi sobrescrito). Os fluxos
`backend` e `web` do GitHub passaram num clone limpo em Linux e aceitam disparo manual.

## Próximo passo

1. **Teste de risco antes do domínio:** uma rota SSE mínima publicada pelo túnel do Cloudflare
   em `api-brazcar.elj-labs.org`, medida num iPhone com o app em primeiro e segundo plano.
   Se o túnel fizer buffer, entra o adaptador de consulta condicional atrás da mesma porta (D-049).
2. Contextos, nesta ordem: `places`, `accounts`, `rides`.
3. Front e PWA.

## Pendências abertas

- CORS com credenciais (D-059) ainda não existe: em desenvolvimento o Vite faz proxy (D-073).
  Entra junto com a sessão, no contexto `accounts`.
- Falta provar o extrator rodando em Python 3.14 quando ele for embutido; se falhar, o recuo é
  para 3.13 (D-070).
- O front ainda não tem teste; o vitest está instalado e roda com `--passWithNoTests`.
- D-040 está como proposto: falta testar se um usuário de banco com `search_path` fixo isola as
  tabelas `whatsmeow_*` sem tocar na URL nem no código Go. Só importa quando o extrator entrar.
- Sobrou uma pasta `.whatsapp_scrapping_wip/proj1/.pytest_cache` com permissão negada no
  Windows. Remover manualmente como administrador. Está no `.gitignore`.
- Texto dos termos de uso e de privacidade ainda não foi escrito (D-033).

## Em voo

Passo 2, teste de risco do SSE: [specs/sse-tunnel-test/plan.md](specs/sse-tunnel-test/plan.md).
Rota de diagnóstico, página `/diagnostics`, imagem, compose de deploy e fluxo do GHCR prontos e
conferidos localmente. Falta tudo o que é fora do repo e depende do ok do Eduardo: push, imagem no
GHCR, subida na máquina de teste, entrada no túnel, DNS, front no Vercel e a medição no iPhone.
