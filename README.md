# BrazCar

Plataforma de caronas entre Brazlândia e o centro de Brasília: tirar os anúncios de carona do
scroll dos grupos de WhatsApp e pô-los num mural com filtros, atualizado sem recarregar.

[![backend](https://github.com/edududs/BrazCar/actions/workflows/backend.yml/badge.svg)](https://github.com/edududs/BrazCar/actions/workflows/backend.yml)
[![web](https://github.com/edududs/BrazCar/actions/workflows/web.yml/badge.svg)](https://github.com/edududs/BrazCar/actions/workflows/web.yml)
[![release](https://github.com/edududs/BrazCar/actions/workflows/release.yml/badge.svg)](https://github.com/edududs/BrazCar/actions/workflows/release.yml)
[![versão](https://img.shields.io/github/v/tag/edududs/BrazCar?label=vers%C3%A3o&sort=semver)](https://github.com/edududs/BrazCar/releases)

## O problema

Moradores de Brazlândia trabalham e estudam no centro de Brasília, a 30 ou 50 km, com transporte
público precário. A comunidade inventou a carona paga: quem já vai de carro anuncia as vagas
livres por R$ 7,00. Esses anúncios vivem em dezenas de grupos de WhatsApp, assim:

```
03 VAGAS
Saindo às 19:30
Esplanada
Eixo Monumental
Estrutural
Brazlândia
Chamar PV
7,00 Dinheiro ou PIX
```

O mesmo anúncio é repostado em cinco, dez grupos e some no scroll em minutos. Não dá para filtrar
por horário nem por rota, e não há histórico. A métrica do produto é o tempo entre abrir o app e
achar uma carona compatível com o meu horário e a minha rota.

## O produto

No ar, na versão `v0.7.0`:

- **App:** [brazcar.elj-labs.org](https://brazcar.elj-labs.org) — PWA instalável em Android e
  iPhone, pensado para uma mão, em pé, com pressa e 4G instável.
- **API:** [api-brazcar.elj-labs.org](https://api-brazcar.elj-labs.org)

O motorista cadastra conta por telefone e carros, publica a carona, ajusta as vagas e pode
cancelar ou repetir. O passageiro abre o mural público, filtra por dia, rota, vagas e preço, e
aperta o botão de contato, que abre a conversa no WhatsApp. O mural se atualiza sozinho, sem
recarregar. A plataforma substitui o WhatsApp como canal de **descoberta**, não como canal de
contato — é onde a conversa continua hoje, e continuará.

## Arquitetura

```mermaid
flowchart LR
    P[Passageiro e motorista] --> W[PWA no Vercel<br/>brazcar.elj-labs.org]
    W -->|HTTPS, cookie de sessão| CF[Cloudflare<br/>túnel nomeado]
    CF --> T[Traefik]
    T --> A[API Django 6 ASGI<br/>api-brazcar.elj-labs.org]
    A --> DB[(Banco único<br/>SQLite ou Postgres)]
    A -->|SMTP| R[Resend]
    W -.wa.me.-> WA[WhatsApp]
    X[Worker do extrator<br/>futuro] --> DB
```

**Hexagonal com DDD, de verdade.** O backend é Python 3.14 com Django 6 ASGI e django-ninja, mas o
Django não é a arquitetura: é um adaptador. Entidades e value objects são Pydantic congelado, casos
de uso são `async` e as portas são `Protocol`. `models.py`, migrations e rotas ninja moram em
`adapters/`. Isso não é uma promessa de documento: um teste percorre a AST de cada arquivo de
`domain/` e `application/` e falha se aparecer um import que não seja stdlib, Pydantic ou a camada
de baixo — e o próprio teste tem casos que provam que o guarda detecta violações deliberadas
([ADR-0001](docs/decisions/0001-hexagonal-ddd-django-in-adapters.md),
[backend/tests/test_architecture.py](backend/tests/test_architecture.py)).

**Contextos com fronteira real.** `rides`, `accounts`, `places` e `search` são pacotes com as três
camadas dentro, cada um com seu app Django em `adapters/`, e `shared` guarda o que não é de
ninguém. Referência entre contextos é por identificador, nunca por objeto: o mesmo teste de
arquitetura recusa `rides.domain` importando `places.domain`. `search` foi escrito para sair do
projeto — o núcleo dele só importa a stdlib, nem `shared`. Cada contexto tem um glossário em
`docs/domain/` que é a linguagem ubíqua: um conceito, um nome, no negócio e no código.

**Banco plugável, provado.** Uma URL escolhe SQLite ou Postgres, e nenhum recurso exclusivo de um
banco entra sem ficar atrás de porta. A prova é executável: o contrato de cada porta é uma classe
de teste herdada pelo fake em memória e pelo adaptador Django, e o portão pesado repete os
contratos no Postgres real do compose, com `EXPECT_DB_VENDOR` para não passar no banco errado
([ADR-0007](docs/decisions/0007-pluggable-database-dual-contract.md),
[backend/tests/contracts/](backend/tests/contracts/)).

**Tempo real com custo fixo.** O mural não faz polling. Uma linha no banco guarda a revisão do
mural, incrementada na mesma transação de toda escrita; uma tarefa única por processo lê essa
revisão uma vez por segundo e manda por SSE apenas "mudou, revisão N". O celular espera até dois
segundos aleatórios e busca a lista, que fica em cache por revisão. O custo do servidor é uma
consulta por segundo, não uma por usuário
([ADR-0010](docs/decisions/0010-board-revision-sse-signal.md)). O desenho fino — batimento como
evento e não comentário, vigia de silêncio em 35s, reconexão como caminho feliz — não foi
adivinhado: veio de medir o caminho real num iPhone
([ADR-0013](docs/decisions/0013-sse-through-tunnel-verdict.md),
[ADR-0014](docs/decisions/0014-sse-standalone-measurement.md)).

## O que este repo demonstra

Cada item com onde conferir.

- **Fronteira arquitetural verificada por máquina**, não por convenção — teste por AST que também
  testa a si mesmo: [`backend/tests/test_architecture.py`](backend/tests/test_architecture.py).
- **Contrato de porta rodando nas duas implementações e nos dois bancos**:
  [`backend/tests/contracts/`](backend/tests/contracts/) e a task `poe test-postgres`.
- **Decisões registradas com as alternativas descartadas** — 107 linhas com status, 14 registros
  completos, e decisão antiga que nunca é editada, só substituída:
  [`docs/decisions/README.md`](docs/decisions/README.md).
- **Medir antes de construir.** A peça mais arriscada do produto (SSE atravessando túnel e o ciclo
  de vida do iOS) foi medida num iPhone real, com rota e página de diagnóstico próprias, e a
  medição mudou números do desenho: [ADR-0013](docs/decisions/0013-sse-through-tunnel-verdict.md) e
  [ADR-0014](docs/decisions/0014-sse-standalone-measurement.md).
- **Tipagem estrita dos dois lados.** ruff com `select = ["ALL"]` e cada ignore justificado,
  pyright em modo `strict`, TypeScript `strict` com eslint `strictTypeChecked`. Sem `Any`, sem
  `any`. O tipo gerado do OpenAPI fica confinado aos adaptadores, e o CI falha se
  [`contract/openapi.json`](contract/openapi.json) divergir do código.
- **Cobertura medida no próprio CI**, sem serviço de terceiros: mínimo exigido de 92% no backend e
  52% nas camadas headless do front, com o resumo impresso no log do fluxo.
- **SemVer que sai dos commits.** [`scripts/release.sh`](scripts/release.sh) calcula a próxima
  versão dos Conventional Commits com git-cliff, gera o `CHANGELOG.md` no formato Keep a Changelog,
  alinha backend e front e cria a tag anotada; a tag vira GitHub Release e imagem no GHCR.
- **Privacidade por desenho.** Telefone e placa nunca entram em payload de lista: saem só por uma
  rota de contato que exige login, tem limite por conta e registra o pedido
  ([ADR-0006](docs/decisions/0006-contact-gated-phone-and-plate.md)).
- **Fonte única de verdade.** A situação da carona não é coluna, é função pura de quatro dados; a
  API devolve a situação e as ações permitidas prontas, e o front não recalcula regra
  ([ADR-0003](docs/decisions/0003-computed-ride-status.md),
  [ADR-0011](docs/decisions/0011-server-computed-status-and-actions.md)).
- **Mínimo de terceiros.** Só Vercel, Resend e Cloudflare. Observabilidade é log JSON e endpoint de
  saúde; limite de requisições é porta com tabela própria; busca por texto é contexto próprio
  trocável por Redis ou Elasticsearch. Nada de Redis, Celery ou SaaS de métrica no caminho.

## Como rodar

Requisitos: [uv](https://docs.astral.sh/uv/), Node 24 e, opcionalmente, Docker para o Postgres.

```sh
cp .env.example .env            # opcional: sem ele a API sobe em modo de desenvolvimento
cd backend && uv sync && uv run poe hooks && uv run poe serve   # API em http://127.0.0.1:8000
cd web && yarn install && yarn dev                              # front em http://localhost:5173
```

Antes de declarar algo pronto: `uv run poe fix` em `backend/` e `yarn fix` em `web/`. O portão que
os hooks e o GitHub rodam é `uv run poe check` e `yarn run check`; o pesado é `uv run poe
check-heavy` e `yarn run check:heavy`. Mudou a API? Rode `uv run poe openapi` e depois
`yarn gen:api`.

## Como o projeto é conduzido

O desenho vem antes do código, as decisões ficam registradas com as alternativas que foram
descartadas, o trabalho anda em passos versionados e cada passo é auditado contra o repositório —
inclusive o que **não** foi verificado, que fica escrito. O processo inteiro, incluindo como
sessões de agente de IA são despachadas e auditadas, está em [docs/method.md](docs/method.md).

## Documentação

Comece pelo índice: [docs/INDEX.md](docs/INDEX.md), uma linha por documento.

## Estado

Onde o projeto está, o que foi verificado de verdade e o próximo passo:
[docs/STATE.md](docs/STATE.md). O que vem depois: [docs/ROADMAP.md](docs/ROADMAP.md). O histórico
de versões: [CHANGELOG.md](CHANGELOG.md).
