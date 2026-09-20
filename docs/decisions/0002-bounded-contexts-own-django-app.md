# 0002 — Um app Django por contexto, dentro de adapters

Status: decidido (2026-09-20). Cobre: D-006, D-024.

## Contexto

O sistema tem três contextos no MVP (`rides`, `accounts`, `places`) e ganhará `importing`. É preciso decidir onde ficam models e migrations.

## Decisão

Cada contexto é um pacote com `domain/`, `application/` e `adapters/`, e o app Django do contexto mora em `adapters/`, com suas próprias migrations. `places` nasce como contexto próprio, não como value object de `rides`. Contextos se referenciam por identificador.

## Alternativas descartadas

- **Um app Django único de persistência.** remover ou extrair um contexto mexeria nas migrations de todos.
- **`places` dentro de `rides`.** o catálogo servirá ao filtro, à publicação, à importação e ao mapa; nascer separado evita a extração depois.

## Consequências

- `importing` entra depois sem tocar no que existe.
- Infraestrutura sem dono (revisão do mural, SSE, limite de requisições, e-mail) fica em `shared`.
