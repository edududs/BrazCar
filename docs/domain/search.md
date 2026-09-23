# Contexto `search`

Busca por texto, feita para sair do projeto: o núcleo (`domain/` e `application/`) só importa a
stdlib, nem `shared` (D-100). Quem usa decide o que indexar; o `search` só decide o que "casa".

## Glossário

| No negócio | No código | O que é |
|---|---|---|
| documento | `SearchDocument` | Algo que pode ser achado: um identificador do dono e os textos pelos quais é achado. |
| índice | `SearchIndex` | Porta: `put`, `remove` e `search(query, among)`. Um índice por tipo de documento (`rides`). |
| texto normalizado | `fold` | Sem acento, sem caixa, espaços únicos. Os dois lados da comparação passam por ele. |
| termos | `terms` | As palavras normalizadas da consulta. Consulta vazia não tem termos e casa com tudo. |
| casar | `matches` | Todo termo da consulta aparece em algum lugar do texto do documento. |

## Invariantes

- Todo adaptador responde igual a `matches`; o contrato de porta prova isso por propriedade.
- O índice é dado derivado. Perder um `put` custa uma busca incompleta até a próxima reconstrução,
  nunca um dado errado na fonte.

## Adaptadores

Hoje, uma tabela (`search_entry`) com o texto normalizado e um `contains` por termo, igual em
SQLite e Postgres. Redis ou Elasticsearch entram como outro adaptador da mesma porta.
