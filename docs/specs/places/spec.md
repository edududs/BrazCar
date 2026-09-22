# Passo 3 — contexto `places` (em andamento; apagar ao fechar)

## O que entrega

O catálogo de lugares de ponta a ponta: domínio, casos de uso, persistência, rotas públicas de
leitura, contrato de repositório nos dois bancos, tipos gerados e hook de busca no front.
É o molde que `accounts` e `rides` vão copiar.

## Requisitos

- R1. `Place` congelado: `id`, `name`, `kind`, `aliases`, `parent_id`, `geometry` (sempre vazio).
- R2. Invariantes do catálogo: nome canônico único; um texto (nome ou apelido) aponta para um
  lugar só; pai existe; hierarquia sem ciclo. Comparação sem acento e sem caixa.
- R3. Buscar por texto em nome ou apelido ("brazlandia" acha "Brazlândia"); texto vazio lista tudo.
- R4. Resolver um lugar com seus descendentes ("Plano Piloto" traz "Esplanada").
- R5. Resolver texto exato para um lugar (base da importação futura); só domínio neste passo.
- R6. Persistência por porta, agregado gravado em função síncrona com `atomic` (ADR-0008).
- R7. Contrato da porta roda no fake em memória, em SQLite e em Postgres (D-039).
- R8. Rotas ninja finas, só leitura: `GET /api/places?q=` e `GET /api/places/{id}`.
- R9. Front: adaptador HTTP, tipos de domínio próprios, hook headless de busca com teste.

## Fora

Admin, autenticação, escrita pela API, geometria, mapa, importação, rides.

## Pendente de decisão do Eduardo

1. Admin agora (antecipando o usuário) ou semente versionada + comando idempotente.
2. Conteúdo do catálogo inicial.
3. Biblioteca headless (React Aria ou Base UI); sem ela o front para no hook.
