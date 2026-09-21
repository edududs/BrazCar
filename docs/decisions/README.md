# Decisões

Tabela única de todas as decisões. Uma linha basta quando o motivo é evidente. Quando não é,
a coluna **Registro** aponta para um arquivo com contexto, decisão e alternativas descartadas.

**Status:** `decidido`, `proposto` (falta validar) ou `adiado` (fora do MVP, com intenção registrada).
Decisão não se edita: cria-se outra e marca-se a antiga como `substituída por D-NNN`.
Origem das linhas até D-068: entrevista de design de 18 a 20/09/2026. As seguintes nasceram na construção.

## Direção

| ID | Decisão | Status | Registro |
|---|---|---|---|
| D-001 | A plataforma é o núcleo e funciona sem o extrator de WhatsApp | decidido | |
| D-002 | Repo novo, monorepo com `src/` (Django) e `web/` (React), deploys separados | substituída por D-069 | |
| D-003 | Backend em Django 6 ASGI com django-ninja | decidido | |
| D-004 | Front em React 19, TypeScript, Vite, Tailwind v4 e yarn 4 | decidido | |
| D-005 | Hexagonal com DDD: domínio em Pydantic, Django só nos adaptadores | decidido | [0001](0001-hexagonal-ddd-django-in-adapters.md) |
| D-006 | Contextos `rides`, `accounts` e `places`, cada um com seu app Django dentro de `adapters/` | decidido | [0002](0002-bounded-contexts-own-django-app.md) |
| D-007 | Código, identificadores e nomes de arquivo em inglês; documentação e interface em pt-BR | decidido | |
| D-008 | Mínimo de serviços de terceiros. Aceitos: Vercel, Resend e Cloudflare | decidido | |
| D-069 | Monorepo com `backend/` e `web/` como pastas irmãs, cada uma dona do seu tooling; contrato em `contract/openapi.json`; a raiz guarda só o que é do repo inteiro | decidido | |
| D-070 | Python 3.14. Descer para 3.13 só se aparecer incompatibilidade real, em especial ao embutir o extrator | decidido | |

## Caronas

| ID | Decisão | Status | Registro |
|---|---|---|---|
| D-009 | Só ofertas de motorista no MVP | decidido | |
| D-010 | Pedido de carona por passageiro é outro agregado | adiado | |
| D-011 | Conversão por link `wa.me`, sem reserva de vaga no app | decidido | |
| D-012 | Carona avulsa com botão "repetir esta carona", sem recorrência | decidido | |
| D-013 | Rota é sequência ordenada de paradas do catálogo, com opção "outro" em texto | decidido | |
| D-014 | Preço único por carona, `Decimal`, padrão R$ 7,00; pagamento em dinheiro ou PIX | decidido | |
| D-015 | Situação da carona é calculada, nunca gravada | decidido | [0003](0003-computed-ride-status.md) |
| D-016 | Aberta exige vaga; zerar vagas fecha; aumentar vagas reabre; "reaberta" é transição | decidido | [0003](0003-computed-ride-status.md) |
| D-017 | "Já saiu" vem do horário mais uma tolerância configurável, sem job agendado | decidido | [0003](0003-computed-ride-status.md) |
| D-018 | Edição em aberta e fechada; antes da partida só no mesmo dia; depois só adiar até 2h do horário original | decidido | [0004](0004-ride-edit-and-delay-rules.md) |
| D-019 | Cancelada é definitiva | decidido | [0004](0004-ride-edit-and-delay-rules.md) |
| D-020 | Entidades congeladas; mudança devolve cópia | decidido | |
| D-021 | Histórico em tabela só de acréscimo, alimentada por eventos de domínio | decidido | [0005](0005-append-only-ride-events.md) |
| D-022 | Pedidos de contato ficam em tabela própria, fora do histórico da carona | decidido | |
| D-023 | A carona guarda cópia dos dados do carro na publicação, além da referência | decidido | |

## Lugares

| ID | Decisão | Status | Registro |
|---|---|---|---|
| D-024 | `places` nasce como contexto próprio: nome canônico, apelidos, tipo, lugar pai, geometria vazia | decidido | [0002](0002-bounded-contexts-own-django-app.md) |
| D-025 | Modelagem de lugar como área e mapa de paradas | adiado | |

## Contas e privacidade

| ID | Decisão | Status | Registro |
|---|---|---|---|
| D-026 | Conta única: telefone, senha e nome social obrigatório; e-mail opcional | decidido | |
| D-027 | Sem verificação de telefone no MVP; campo de verificado já previsto | decidido | |
| D-028 | Usuário customizado do Django desde a primeira migration; `Account` é do domínio | decidido | |
| D-029 | Publicar exige carro cadastrado: modelo, cor e placa; vários carros por conta | decidido | |
| D-030 | Mural público sem login; toda interação exige login | decidido | [0006](0006-contact-gated-phone-and-plate.md) |
| D-031 | Telefone e placa só saem pela rota de contato, com limite por conta e registro | decidido | [0006](0006-contact-gated-phone-and-plate.md) |
| D-032 | Recuperação de senha por e-mail via Resend (SMTP), atrás de porta; manual como último recurso | decidido | |
| D-033 | Termos no cadastro e exclusão de conta com anonimização já no MVP | decidido | |
| D-034 | Verificação de telefone por OTP reverso via WhatsApp | adiado | |

## Persistência

| ID | Decisão | Status | Registro |
|---|---|---|---|
| D-035 | Banco único e plugável pelo ORM: SQLite ou Postgres para tudo | decidido | [0007](0007-pluggable-database-dual-contract.md) |
| D-036 | Produção com Postgres em container no próprio compose | decidido | |
| D-037 | Supabase, se usado, é só host de Postgres, com a Data API desligada | decidido | |
| D-038 | O adaptador grava cada agregado numa função síncrona com `atomic` | decidido | [0008](0008-sync-atomic-per-aggregate.md) |
| D-039 | Contrato de repositório roda em SQLite e em Postgres | decidido | [0007](0007-pluggable-database-dual-contract.md) |

## Extrator de WhatsApp

| ID | Decisão | Status | Registro |
|---|---|---|---|
| D-040 | Tabelas `whatsmeow_*` isoladas por usuário de banco com `search_path` próprio | proposto | [0009](0009-extractor-via-django-store.md) |
| D-041 | O repo do extrator nunca é alterado a partir daqui; ele só extrai, nunca envia | decidido | [0009](0009-extractor-via-django-store.md) |
| D-042 | `DjangoStore` implementa a porta de escrita do extrator, no lugar de SQLAlchemy e Alembic | decidido | [0009](0009-extractor-via-django-store.md) |
| D-043 | O extrator roda como management command em serviço próprio, com reinício automático | decidido | [0009](0009-extractor-via-django-store.md) |
| D-044 | A importação lê da tabela de mensagens com marcador; o evento só acorda o consumidor | decidido | [0009](0009-extractor-via-django-store.md) |
| D-045 | Contexto `importing`: mensagem candidata, revisão, vira carona | adiado | |

## Tempo real e PWA

| ID | Decisão | Status | Registro |
|---|---|---|---|
| D-046 | Revisão do mural no banco, sinal por SSE, contador lido uma vez por segundo | decidido | [0010](0010-board-revision-sse-signal.md) |
| D-047 | Celular espera até 2s aleatórios antes de buscar; lista em cache por revisão | decidido | [0010](0010-board-revision-sse-signal.md) |
| D-048 | Buscar de novo ao focar a aba e ao voltar a rede, sempre | decidido | [0010](0010-board-revision-sse-signal.md) |
| D-049 | Primeira tarefa técnica: testar SSE pelo túnel do Cloudflare num iPhone | decidido | [0010](0010-board-revision-sse-signal.md) |
| D-050 | `LISTEN/NOTIFY` como segundo adaptador da mesma porta | adiado | |
| D-051 | PWA online-only: sem rede, tela de aviso | decidido | |
| D-052 | Atualização do app em modo `prompt` e piso de versão informado pela API | decidido | |
| D-076 | SSE confirmado pelo túnel: eventos um a um (atraso médio 35 ms), HTTP/2 na borda, 100 conexões por ~10 MiB; no iPhone a conexão morre em segundo plano e volta em ~1s. Consulta condicional não é necessária | decidido | [0013](0013-sse-through-tunnel-verdict.md) |
| D-077 | Batimento SSE é evento `ping` a cada 15s, não comentário; reconectar é caminho feliz; ao voltar ao foco a conexão tem 3s para provar que vive; rajada ao acordar vale um sinal só | decidido | [0013](0013-sse-through-tunnel-verdict.md) |

## Front

| ID | Decisão | Status | Registro |
|---|---|---|---|
| D-053 | Organização por funcionalidade, com quatro camadas dentro de cada uma | decidido | |
| D-054 | A API devolve a situação calculada e as ações permitidas; o front não recalcula regra | decidido | [0011](0011-server-computed-status-and-actions.md) |
| D-055 | Tipos gerados do OpenAPI do ninja, confinados aos adaptadores | decidido | |
| D-056 | TanStack Router e TanStack Query | decidido | |
| D-057 | Primitivos sobre biblioteca headless, com Tailwind v4 e tokens em variáveis CSS | decidido | |
| D-071 | TypeScript fica na 6.0.x: a 7 (porta nativa) não expõe a API de compilador que o typescript-eslint e o openapi-typescript usam. Subir quando os dois suportarem | decidido | |
| D-072 | Rotas do TanStack Router por arquivo em `web/src/routes/`, finas, só compondo; `routeTree.gen.ts` é gerado e versionado | decidido | |
| D-073 | Em desenvolvimento o Vite faz proxy de `/api` para a API local; em produção o front usa `VITE_API_BASE_URL` | decidido | |

## Deploy e operação

| ID | Decisão | Status | Registro |
|---|---|---|---|
| D-058 | Endereços `brazcar.elj-labs.org` e `api-brazcar.elj-labs.org`, ambos de primeiro nível | decidido | [0012](0012-session-cookie-sibling-origins.md) |
| D-059 | Cookie de sessão httpOnly `SameSite=Lax`, CORS com credenciais, checagem de `Origin` | decidido | [0012](0012-session-cookie-sibling-origins.md) |
| D-060 | Front no Vercel; API na máquina de teste por compose, Traefik e túnel do Cloudflare | decidido | |
| D-061 | Migração no entrypoint, ligada por `RUN_MIGRATIONS=1` só na API; worker espera a API saudável | decidido | |
| D-062 | Admin do Django escreve só em `places`; resto somente leitura; moderação chama caso de uso | decidido | |
| D-063 | Observabilidade: logs JSON e endpoint de saúde, sem terceiros | decidido | |
| D-064 | Limite de requisições na aplicação, atrás de porta | decidido | |
| D-065 | Testes: arquitetura por AST, domínio, Hypothesis, contrato nos dois bancos, Schemathesis, E2E, hooks do front | decidido | |
| D-066 | GitHub roda só o portão rápido; testes pesados rodam localmente em `pre-push` | decidido | |
| D-067 | Imagens no GHCR, publicadas ao criar tag | decidido | |
| D-068 | Ordem de construção: esqueleto, teste do SSE, `places`, `accounts`, `rides`, front | decidido | |
| D-074 | Hooks são scripts versionados em `.githooks/`, ligados por `core.hooksPath` (`uv run poe hooks`), sem o framework pre-commit; cada portão só roda se o caminho dele mudou | decidido | |
| D-075 | `domain/` e `application/` de um contexto podem importar as mesmas camadas de `shared`, nunca as de outro contexto; o teste de arquitetura cobre isso | decidido | |
| D-078 | API em uvicorn, um processo por container (o sinal do mural é uma tarefa por processo web); a imagem traz o próprio healthcheck, que se apresenta com o primeiro host permitido | decidido | |
| D-080 | Encerramento de passo segue `docs/runbooks/close-step.md`: Conventional Commits, SemVer com a versão calculada dos commits, `CHANGELOG.md` gerado pelo git-cliff no formato Keep a Changelog, tag anotada com as notas e GitHub Release criada a partir da tag. A tag é a fonte da verdade da versão | decidido | |
| D-081 | A imagem da API é pública e a máquina de teste a puxa como anônimo, com um `DOCKER_CONFIG` próprio e vazio em `~/.brazcar/docker`; sem token de GHCR para o BrazCar | decidido | |
| D-079 | CORS por `django-cors-headers`, com origens explícitas vindas do ambiente; é a parte de D-059 que já existe | decidido | |

## Por que algumas linhas não têm registro

D-080: release-please e semantic-release automatizam o mesmo, mas decidem no GitHub; aqui a versão é cortada localmente, o push continua sendo do dono, e o GitHub só transforma a tag em release. D-081: o login de `ghcr.io` guardado no usuário da máquina é de outro projeto e faz o registro responder `denied` até para imagem pública; um token novo resolveria, mas seria um segredo a mais para guardar e renovar sem necessidade. Se a imagem virar privada, o caminho é o do JayceFinance: token clássico só com `read:packages`, `docker login` por stdin nesse mesmo diretório. D-078: o granian foi considerado; conexões SSE ociosas são tarefas asyncio paradas, a 0,1 MiB cada,
e o uvicorn já era o servidor de desenvolvimento e o dos logs JSON. D-061: o passo de migração separado protegeria contra falha antes da troca, mas num ambiente de
teste com uma API só o entrypoint é mais simples. D-058: `api.brazcar` seria de segundo nível e
fora do certificado grátis. D-032: o envio de e-mail do Cloudflare exige plano pago; o Resend é
gratuito nesse volume e fala SMTP. D-066: o Postgres no GitHub alongaria cada execução.
