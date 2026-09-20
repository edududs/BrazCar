# 0001 — Hexagonal com DDD, Django só nos adaptadores

Status: decidido (2026-09-20). Cobre: D-005.

## Contexto

O Django convida a pôr regra de negócio em models, signals e views. O projeto quer regra testável sem banco, e o extrator de WhatsApp, que será embutido depois, já segue hexagonal com domínio em Pydantic.

## Decisão

Domínio e casos de uso em Pydantic puro: value objects e entidades congeladas, portas como `Protocol`, casos de uso `async`. `models.py`, migrations, admin e rotas ninja moram em `adapters/`. O adaptador traduz model em entidade e entidade em model. Um teste de arquitetura por AST proíbe Django em `domain/` e `application/`.

## Alternativas descartadas

- **Django tradicional com fat models.** regra presa ao ORM, teste exige banco, e o padrão diverge do extrator.
- **`import-linter` para a fronteira.** o teste por AST já é o padrão usado no extrator; duas ferramentas para a mesma regra seriam duplicação.

## Consequências

- Há código de mapeamento entre model e entidade. É o preço do isolamento.
- Testes de domínio rodam sem Django e sem banco.
- ninja serializa entidades Pydantic direto, porque os schemas dele já são Pydantic.
