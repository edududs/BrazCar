# Resultados

Só entra aqui o que foi medido, com data e de onde. [Plano](plan.md).

## Local, sem proxy (2026-09-21, Windows, uvicorn 0.53, Chrome)

| Medição | Valor |
|---|---|
| Entrega | um evento por vez; intervalo mín/méd/máx 977 / 1000 / 1030 ms; 0 rajadas, 0 travadas, 0 perdidos |
| Atraso | médio 5 ms, máximo 24 ms (mesma máquina, sem diferença de relógio) |
| 100 conexões por 8s | 100 abertas, 0 cortadas, 800 quadros, primeiro quadro em até 0,29s, intervalos entre 0,95 e 1,01s |
| Imagem | 304 MB; migração no entrypoint, `healthy`, para em 1s com stream aberto |
| Batimento em comentário | invisível ao vigia: reconexão por silêncio mesmo com a conexão viva |

Serve de linha de base. Nada disso responde à pergunta do passo: falta o túnel e o iPhone.

## Pelo túnel

Pendente.

## iPhone

Pendente.
