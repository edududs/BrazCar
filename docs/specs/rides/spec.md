# Passo 5 — contexto `rides` (em andamento; apagar ao fechar)

## Requisitos

- R1. `RideOffer` congelada: motorista (`AccountId`), `CarSnapshot`, `Route` (2+ `Stop`, cada uma
  lugar do catálogo ou texto livre, D-013), `departure_at`, `original_departure_at` imutável,
  `seats_available`, `price` (`Decimal`, padrão 7,00), formas de pagamento, `reopened_at`,
  `cancelled_at`. Situação é função pura (ADR-0003). Mudança devolve cópia e eventos (ADR-0005).
- R2. Regras: publicar exige carro (D-029); vagas zero fecha, aumentar de zero reabre; cancelar
  é definitivo; edição conforme ADR-0004; repetir cria carona nova com os dados de outra.
- R3. Mural público: caronas não canceladas e não "já saiu", por horário; filtros por data,
  lugar (com descendentes, via `places`), só com vagas e preço máximo. Payload sem telefone nem
  placa (ADR-0006); traz situação e ações permitidas para quem vê (ADR-0011).
- R4. Contato: exige login, limite por conta atrás de porta (D-064), grava `ContactRequest`,
  devolve link `wa.me` com mensagem pronta e a placa.
- R5. Toda escrita incrementa a revisão do mural na mesma transação (ADR-0010); rota lê a revisão.
- R6. Contrato de `RideRepository` no fake, em SQLite e em Postgres.
- R7. Front: mural com filtros na URL, publicar/editar/vagas/cancelar/repetir, botão de contato.

## Fora

SSE de verdade (passo 6), importação, pedido de carona, recorrência, preço por trecho.
