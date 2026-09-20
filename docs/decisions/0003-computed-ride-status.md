# 0003 — Situação da carona calculada, não gravada

Status: decidido (2026-09-20). Cobre: D-015, D-016, D-017.

## Contexto

A carona passa por aberta, fechada, reaberta, cancelada e já saiu. O caminho óbvio seria uma coluna de situação.

## Decisão

Não existe coluna de situação. Ela é função pura de `cancelled_at`, `departure_at`, `seats_available` e `reopened_at`, lida nesta ordem: cancelada, já saiu, fechada (zero vagas), reaberta ou aberta. Zerar vagas fecha; aumentar vagas de uma fechada reabre. "Já saiu" usa o horário mais uma tolerância configurável.

## Alternativas descartadas

- **Coluna de situação sincronizada com as vagas.** dois lugares dizendo a mesma coisa acabam discordando.
- **"Reaberta" como quarto estado gravado.** toda consulta de disponíveis teria que pedir "aberta ou reaberta", e esquecer uma vez esconde caronas.
- **Job que fecha caronas pelo horário.** estado que é função do relógio não precisa ser gravado, e a carona importada, sem dono, precisa expirar sozinha.

## Consequências

- Filtrar o mural por situação vira condição sobre os quatro dados, não igualdade numa coluna.
- A função de situação é alvo natural de testes de propriedade.
- Quem sentir falta da coluna deve ler este registro antes de criá-la.
