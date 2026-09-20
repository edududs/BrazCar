# 0004 — Regras de edição e de atraso

Status: decidido (2026-09-20). Cobre: D-018, D-019.

## Contexto

Motorista erra, atrasa e muda de turno. Mas carona que muda livremente vira sujeira: uma viagem de ontem empurrada para amanhã carrega o histórico de outra viagem.

## Decisão

Editar é permitido em carona aberta ou fechada, nunca em cancelada, que é definitiva. Antes da partida o horário só muda dentro do mesmo dia. Depois da partida só se pode adiar, até duas horas depois de `original_departure_at`, gravado uma vez e imutável. Passado isso a carona trava: cancelar ou repetir.

## Alternativas descartadas

- **Edição livre.** cada viagem deixa de ser um registro próprio, o que quebra histórico e reputação futuros.
- **Limite contado do horário atual.** permitiria encadear duas horas mais duas horas.
- **Reabrir carona cancelada.** o botão de repetir resolve com menos regra.

## Consequências

- `original_departure_at` é um fato imutável do agregado.
- A regra de atraso é alvo de testes de propriedade.
