# BrazCar

Plataforma de caronas entre Brazlândia e o centro de Brasília. O motorista registra a carona,
o passageiro a encontra num mural com filtros, e a conversa continua no WhatsApp.

Monorepo: `backend/` com Django 6 e django-ninja, `web/` com React 19 e TypeScript, instalável
como PWA, e `contract/openapi.json` como contrato entre os dois.

## Rodar localmente

Requisitos: uv, Node 24 e, opcionalmente, Docker para o Postgres.

```sh
cp .env.example .env            # opcional: sem ele a API sobe em modo de desenvolvimento
cd backend && uv sync && uv run poe hooks && uv run poe serve   # API em http://127.0.0.1:8000
cd web && yarn install && yarn dev                              # front em http://localhost:5173
```

Antes de declarar algo pronto: `uv run poe fix` em `backend/` e `yarn fix` em `web/`. O portão
que os hooks e o GitHub rodam é `uv run poe check` e `yarn run check`. Mudou a API? Rode
`uv run poe openapi` e depois `yarn gen:api`.

## Documentação

- [docs/product.md](docs/product.md): o problema e o que o produto faz.
- [docs/architecture.md](docs/architecture.md): blocos e fluxos.
- [docs/decisions/README.md](docs/decisions/README.md): o que foi decidido e por quê.
- [docs/STATE.md](docs/STATE.md): onde estamos e o próximo passo.
