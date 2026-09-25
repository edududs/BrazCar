# BrazCar

Plataforma de caronas entre Brazlândia e o centro de Brasília: tira os anúncios de carona do scroll
dos grupos de WhatsApp e os põe num mural com filtros, atualizado sem recarregar.

[![backend](https://github.com/edududs/BrazCar/actions/workflows/backend.yml/badge.svg)](https://github.com/edududs/BrazCar/actions/workflows/backend.yml)
[![web](https://github.com/edududs/BrazCar/actions/workflows/web.yml/badge.svg)](https://github.com/edududs/BrazCar/actions/workflows/web.yml)
[![release](https://github.com/edududs/BrazCar/actions/workflows/release.yml/badge.svg)](https://github.com/edududs/BrazCar/actions/workflows/release.yml)
[![versão](https://img.shields.io/github/v/tag/edududs/BrazCar?label=vers%C3%A3o&sort=semver)](https://github.com/edududs/BrazCar/releases)
[![licença](https://img.shields.io/badge/licen%C3%A7a-MIT-blue)](LICENSE)

## Beta fechado

O acesso à instância em produção é fechado: só entra quem recebe convite, para as pessoas das
comunidades de carona de Brazlândia que hoje anunciam nos grupos de WhatsApp. O motivo é privacidade:
o produto importa mensagem de grupo e expõe telefone de motorista que nunca se cadastrou, e cadastro
aberto deixaria qualquer pessoa alcançar esse dado (decisões em
[docs/decisions/README.md](docs/decisions/README.md), D-159 em diante).

O repositório continua público, para quem quiser ler o código, estudar as decisões ou rodar em casa.
Para rodar em casa, siga "Como rodar" abaixo e use `manage.py seed_demo` para povoar o banco com a
semente de demonstração, no lugar de dado real.

## O problema

Moradores de Brazlândia trabalham e estudam no centro de Brasília, a 30 ou 50 km, com transporte
público precário. A comunidade organizou a carona paga: quem já vai de carro anuncia as vagas
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
achar uma carona compatível com o horário e a rota de quem procura.

## O produto

No ar na `v0.7.0`; a `v0.8.0` está cortada e ainda não foi publicada na máquina:

- **App:** [brazcar.elj-labs.org](https://brazcar.elj-labs.org). PWA instalável em Android e iPhone,
  feito para uso com uma mão, em pé, com pressa e 4G instável.
- **API:** [api-brazcar.elj-labs.org](https://api-brazcar.elj-labs.org)

O motorista cadastra conta por telefone e carros, publica a carona, ajusta as vagas e pode cancelar
ou repetir. O passageiro abre o mural público, filtra por dia, rota, vagas e preço, e aperta o botão
de contato, que abre a conversa no WhatsApp. O mural se atualiza sozinho, sem recarregar. A
plataforma cobre a descoberta da carona; a conversa segue no WhatsApp, como já acontece.

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
    X[Worker do extrator<br/>mesma imagem da API] --> DB
    X -.lê.-> WA
```

**Hexagonal com DDD.** O backend é Python 3.14 com Django 6 ASGI e django-ninja, e o Django entra
como adaptador. Entidades e value objects são Pydantic congelado, casos de uso são `async`, portas
são `Protocol`. `models.py`, migrations e rotas ninja ficam em `adapters/`. A fronteira é testada:
[`backend/tests/test_architecture.py`](backend/tests/test_architecture.py) percorre a AST de cada
arquivo de `domain/` e `application/` e falha quando aparece um import que não seja stdlib, Pydantic
ou a camada de baixo. O arquivo tem dois testes que exercitam o próprio guarda, um com violações
deliberadas e outro com os imports permitidos
([ADR-0001](docs/decisions/0001-hexagonal-ddd-django-in-adapters.md)).

**Contextos com fronteira.** `rides`, `accounts`, `places`, `search` e `importing` são pacotes com
as três camadas dentro, cada um com seu app Django em `adapters/`; `shared` guarda a infraestrutura
que não é de nenhum contexto. Referência entre contextos é por identificador, e o teste de arquitetura
recusa `rides.domain` importando `places.domain`. O núcleo de `search` importa só a stdlib, nem
`shared`, para poder sair do projeto. Cada contexto tem um glossário em
`docs/domain/`, que fixa um nome único para cada conceito no negócio e no código.

**Banco plugável.** Uma URL escolhe SQLite ou Postgres, e nenhum recurso exclusivo de um banco entra
sem ficar atrás de porta. O contrato de cada porta é uma classe de teste herdada pelo fake em
memória e pelo adaptador Django; o portão pesado repete esses contratos no Postgres do compose, com
`EXPECT_DB_VENDOR` para recusar execução no banco errado
([ADR-0007](docs/decisions/0007-pluggable-database-dual-contract.md),
[backend/tests/contracts/](backend/tests/contracts/)).

**Tempo real por revisão do mural.** Uma linha no banco guarda a revisão do mural, incrementada na
mesma transação de toda escrita. Uma tarefa única por processo lê essa revisão uma vez por segundo e
manda por SSE só "mudou, revisão N". O celular espera até dois segundos aleatórios e busca a lista,
que fica em cache por revisão. O custo no servidor é uma consulta por segundo, independente do
número de usuários ([ADR-0010](docs/decisions/0010-board-revision-sse-signal.md)). O batimento é
evento a cada 15s, o vigia de silêncio do cliente dispara com 35s sem notícia, e a reconexão é
tratada como caminho normal. As três escolhas saíram da medição do caminho real num iPhone
([ADR-0013](docs/decisions/0013-sse-through-tunnel-verdict.md),
[ADR-0014](docs/decisions/0014-sse-standalone-measurement.md)).

## O que este repo demonstra

Cada item indica onde conferir.

- **Fronteira arquitetural testada por AST**, com dois testes do próprio guarda:
  [`backend/tests/test_architecture.py`](backend/tests/test_architecture.py).
- **Contrato de porta rodando nas duas implementações e nos dois bancos**:
  [`backend/tests/contracts/`](backend/tests/contracts/) e a task `poe test-postgres`.
- **Decisões registradas com as alternativas descartadas.** 126 linhas com status e 16 registros
  completos. Decisão antiga não é editada: entra uma linha nova e a antiga passa a "substituída
  por". [`docs/decisions/README.md`](docs/decisions/README.md).
- **Medição antes de construção.** O SSE atravessando o túnel do Cloudflare e o ciclo de vida do iOS
  foi medido num iPhone, com rota e página de diagnóstico próprias, antes de o produto ser
  construído em cima dele: [ADR-0013](docs/decisions/0013-sse-through-tunnel-verdict.md) e
  [ADR-0014](docs/decisions/0014-sse-standalone-measurement.md).
- **Tipagem estrita dos dois lados.** ruff com `select = ["ALL"]` e cada ignore justificado, pyright
  em modo `strict`, TypeScript `strict` com eslint `strictTypeChecked`. Sem `Any` e sem `any`. O
  tipo gerado do OpenAPI fica confinado aos adaptadores, e o CI falha se
  [`contract/openapi.json`](contract/openapi.json) divergir do código.
- **Cobertura medida no próprio CI**, sem serviço de terceiros, com o resumo impresso no log do
  fluxo. Backend: 92% medidos sobre `src/brazcar`, mínimo exigido de 87%. Front: 20% medidos sobre
  `src`, mínimo exigido de 15%, porque hoje só os hooks headless têm teste. A meta do front é
  paridade com o backend, cobrindo componentes e comportamento (D-126).
- **Versão calculada dos commits.** [`scripts/release.sh`](scripts/release.sh) lê os Conventional
  Commits com git-cliff, calcula o próximo SemVer, gera o `CHANGELOG.md` no formato Keep a
  Changelog, alinha backend e front e cria a tag anotada. A tag vira GitHub Release e imagem no
  GHCR.
- **Privacidade por desenho.** Telefone e placa ficam fora de todo payload de lista. Saem por uma
  rota de contato que exige login, aplica limite por conta e registra o pedido
  ([ADR-0006](docs/decisions/0006-contact-gated-phone-and-plate.md)).
- **Fonte única de verdade.** A situação da carona é função pura de quatro dados, sem coluna que a
  guarde; a API devolve a situação e as ações permitidas já calculadas, e o front desenha o que
  recebe ([ADR-0003](docs/decisions/0003-computed-ride-status.md),
  [ADR-0011](docs/decisions/0011-server-computed-status-and-actions.md)).
- **Mínimo de terceiros.** Os serviços externos são Vercel, Resend e Cloudflare. Observabilidade é
  log JSON e endpoint de saúde, limite de requisições é porta com tabela própria, e busca por texto
  é contexto próprio, trocável por Redis ou Elasticsearch sem tocar no domínio. Não há Redis,
  Celery nem SaaS de métrica em produção.

## Como rodar

Requisitos: [uv](https://docs.astral.sh/uv/), Node 24 e, opcionalmente, Docker para o Postgres.

```sh
cp .env.example .env            # opcional: sem ele a API sobe em modo de desenvolvimento
cd backend && uv sync && uv run poe hooks && uv run poe serve   # API em http://127.0.0.1:8000
cd web && yarn install && yarn dev                              # front em http://localhost:5173
```

Antes de declarar algo pronto: `uv run poe fix` em `backend/` e `yarn fix` em `web/`. O portão que o
hook de `pre-commit` roda é `uv run poe check` e `yarn run check`; o GitHub roda o mesmo portão
rápido e, além dele, o pesado (`uv run poe check-heavy` e `yarn run check:heavy`), que também é ato
explícito do ritual de encerramento local. Mudou a API? Rode `uv run poe openapi` e depois
`yarn gen:api`.

## Como o projeto é conduzido

O desenho vem antes do código, as decisões ficam registradas com as alternativas descartadas, o
trabalho anda em passos versionados, e cada passo é auditado contra o repositório. O que a auditoria
não conseguiu confirmar fica escrito numa seção própria do `STATE.md`. O processo, incluindo como as
sessões de agentes de IA são despachadas e auditadas, está em [docs/method.md](docs/method.md).

## Documentação

Comece pelo índice: [docs/INDEX.md](docs/INDEX.md), uma linha por documento.

## Estado

Onde o projeto está, o que foi verificado e o próximo passo: [docs/STATE.md](docs/STATE.md). O que
vem depois: [docs/ROADMAP.md](docs/ROADMAP.md). O histórico de versões:
[CHANGELOG.md](CHANGELOG.md).

Licença: MIT ([LICENSE](LICENSE)).
