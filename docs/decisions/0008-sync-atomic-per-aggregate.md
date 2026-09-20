# 0008 — Transação por agregado em função síncrona

Status: decidido (2026-09-20). Cobre: D-038.

## Contexto

O projeto é async, mas o Django 6 não suporta transações em modo async, e os métodos `aget` e `asave` são eles mesmos um salto de thread por chamada. Publicar uma carona grava várias linhas que precisam entrar juntas.

## Decisão

Cada método de repositório que grava um agregado é uma função síncrona com `transaction.atomic`, exposta como `async` por `sync_to_async`. A porta continua `async` e o domínio não sabe da limitação.

## Alternativas descartadas

- **Porta de unit of work.** não evita o salto de thread e não consegue segurar `atomic` entre dois `await`.
- **`asave` linha a linha.** sem transação, e com um salto de thread por linha em vez de um por agregado.

## Consequências

- Custo: um salto de thread por agregado, dezenas de microssegundos contra milissegundos da ida ao banco.
- Conexões persistentes ficam desligadas em modo async, como a documentação do Django recomenda.
- Unit of work só entra se um caso de uso precisar gravar dois agregados juntos.
