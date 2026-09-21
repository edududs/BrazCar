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

## Pelo caminho real (2026-09-21)

Cliente na própria máquina de teste, saindo para `https://api-brazcar.elj-labs.org` e voltando pelo
túnel: Cloudflare (GRU) → cloudflared 2026.5.0 (QUIC) → Traefik v3 em HTTP → uvicorn. Mesmo relógio
nas duas pontas, então o atraso é real.

| # | Medição | Só Traefik | Pelo Cloudflare |
|---|---|---|---|
| 1 | Entrega (60 eventos a 1s) | um a um; intervalo 985 / 999 / 1001 ms | um a um; mín 762, méd 1000, p99 1003, máx 1237 ms; **0 rajadas, 0 travadas** |
| 2 | Primeiro evento | — | 141 ms |
| 2 | Atraso médio / máximo | 2,7 / 17 ms | 34,5 / 267 ms |
| 4 | Protocolo | HTTP/1.1 | **HTTP/2** (ALPN `h2`, `curl` reporta `http/2`); a borda anuncia `h3` |

Cabeçalhos que chegam ao cliente: `content-type: text/event-stream`, `cache-control: no-cache,
no-transform`, `cf-cache-status: DYNAMIC`, sem `content-encoding`. O Traefik não tem middleware de
compressão. CORS pelo caminho real: a origem `https://brazcar.elj-labs.org` recebe
`access-control-allow-origin` e `allow-credentials: true`; origem estranha não recebe nada.

### 3. Conexão ociosa

| Conexão | Resultado |
|---|---|
| Muda (sem evento nem batimento) | cortada pela borda aos **126s** (`curl` 92, stream HTTP/2 encerrado) |
| Batimento em comentário a cada 90s | passou dos 126s; viveu 527s |
| Batimento em comentário a cada 15s | viveu 527s |

As duas com batimento caíram no mesmo segundo (15:09:00 UTC), e o log do cloudflared mostra nessa
hora `Connection terminated` e novo registro de uma das 4 conexões do túnel. **Não é ociosidade, é
rotatividade do túnel:** todo stream que passa por aquela conexão cai junto. Em 5 dias o log tem
172 dessas quedas, em rajadas (até 22 numa hora, depois horas sem nenhuma). Consequência de projeto:
cair é rotina, e a reconexão do cliente é parte do caminho feliz, não tratamento de erro.

Teste longo (3 streams escalonados, 40 min): pendente.

### 6. Custo no servidor (batimento a cada 15s, sem eventos)

| Conexões | Memória da API | Descritores | Traefik | cloudflared |
|---|---|---|---|---|
| 3 | 69,2 MiB | 8 | 110,6 MiB | 38 MB |
| 20 | 70,8 MiB | 28 | 114 MiB | 39 MB |
| 100 | 78,9 MiB | 109 | 126,7 MiB | 46 MB |

Cerca de **0,1 MiB e 1 descritor por conexão** na API, CPU estável em 0,2%. 100 de 100 abriram e
nenhuma caiu em 60s. Ao fechar, os descritores voltam ao normal em até um batimento (~15s): o
servidor só percebe a desconexão quando tenta escrever. O limite de descritores do container não foi
mexido; com esse custo, o primeiro teto real é ele (1024 por padrão em muitos ambientes), a conferir
antes de esperar centenas de usuários simultâneos.

## iPhone

Pendente: depende do Eduardo seguir o [roteiro](plan.md#roteiro-do-iphone-eduardo).
