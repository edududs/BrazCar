# 0005 — Histórico por eventos de domínio em tabela só de acréscimo

Status: decidido (2026-09-20). Cobre: D-021, D-022.

## Contexto

O objetivo é guardar histórico para, no futuro, gerar gráficos e mostrar "editada" e "reaberta". Não é um ledger: o estado atual continua sendo a fonte da verdade.

## Decisão

A entidade emite eventos (`RidePublished`, `SeatsChanged`, `RideEdited`, `RideReopened`, `RideCancelled`). O repositório os grava na tabela `RideEvent`, só de acréscimo, na mesma transação do estado. Nenhuma regra de domínio lê essa tabela. Pedidos de contato ficam em tabela própria, porque não mudam a carona.

## Alternativas descartadas

- **`django-simple-history` ou `django-pghistory`.** gravam fotos de linha, não o que aconteceu; e a segunda usa gatilhos do Postgres, o que quebra o banco plugável.
- **Campo JSON acumulando lista na carona.** acrescentar exige ler e regravar, dá corrida entre edições, e a linha cresce sem limite.
- **Ledger completo com projeção.** desenho certo para dinheiro; aqui recriaria duas fontes da verdade.

## Consequências

- Os mesmos eventos alimentam o histórico e o incremento da revisão do mural.
- Perguntas como caronas por dia ou tempo até lotar saem de contagem direta.
