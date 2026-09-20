# 0007 — Banco único e plugável, provado por contrato nos dois bancos

Status: decidido (2026-09-20). Cobre: D-035, D-039.

## Contexto

O sistema deve trocar de banco mudando uma URL, e nunca ter duas pontas em bancos diferentes, como aconteceu nas gerações anteriores do projeto.

## Decisão

Um banco só para tudo, escolhido pelo ORM: SQLite ou Postgres. Nenhum recurso exclusivo de um banco entra sem ficar atrás de porta com alternativa. O contrato de repositório de cada porta roda contra os dois bancos.

## Alternativas descartadas

- **Postgres obrigatório.** descarta o SQLite para desenvolvimento e testes simples.
- **Recursos exclusivos do Postgres usados direto.** gatilhos e `LISTEN/NOTIFY` quebrariam a troca; por isso a revisão do mural tem adaptador neutro.

## Consequências

- O contrato nos dois bancos é pesado e roda localmente, não no GitHub.
- Com SQLite, a sessão do WhatsApp fica em arquivo próprio, porque é o código Go que o abre.
