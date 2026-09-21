# 0013 — Veredito do SSE pelo túnel do Cloudflare

Status: decidido (2026-09-21). Cobre: D-076, D-077. Fecha o risco aberto em [0010](0010-board-revision-sse-signal.md) (D-049).

## Contexto

O sinal do mural (D-046) depende de uma conexão SSE atravessar Cloudflare → túnel nomeado (QUIC) →
Traefik em HTTP → uvicorn, e de se comportar num iPhone. Mediu-se com uma rota de diagnóstico que
emite um evento numerado por segundo com o relógio do servidor, e uma página que registra atraso,
intervalos e cada transição de visibilidade e de rede.

## O que se mediu

Pelo caminho real, cliente na própria máquina de teste (mesmo relógio nas duas pontas):

| Medição | Resultado |
|---|---|
| Entrega de 60 eventos a 1s | um a um; intervalo mín 762, méd 1000, p99 1003, máx 1237 ms; 0 rajadas |
| Só pelo Traefik, sem Cloudflare | intervalo 985 a 1001 ms |
| Primeiro evento | 141 ms |
| Atraso médio / máximo | 34,5 / 267 ms |
| Protocolo até a borda | HTTP/2 (ALPN `h2`); a borda anuncia `h3` |
| Conexão muda | cortada pela borda aos 126s |
| Com batimento a cada 15s | 3 streams viveram 40 min inteiros |
| Queda de uma conexão do túnel | derruba juntos os streams que passam por ela; 172 quedas em 5 dias, em rajadas |
| 100 conexões ociosas | +10 MiB na API (~0,1 MiB e 1 descritor cada), CPU 0,2%; descritores liberados em até um batimento |

iPhone (iOS 18.7, Safari 26.6, aba do navegador, Wi-Fi e 4G):

| Situação | Resultado |
|---|---|
| Primeiro plano, 2 min | um evento por segundo, atraso de 35 a 370 ms, 0 rajadas |
| Tela bloqueada ~40s | JavaScript suspenso 1s após o bloqueio; o sistema ainda recebeu ~30s de dados e os entregou de uma vez ao acordar (31 eventos, atraso de 40s a 10s); a conexão estava morta e `readyState` dizia `open` até o erro, 11 ms depois; reconectada em 3,2s |
| Bloqueada 2 min e 10 min; outro app 83s | conexão morta; ao acordar, o vigia de silêncio (timer congelado) dispara primeiro; reconectada em 0,25 a 1,06s |
| Wi-Fi desligado | o navegador reconectou sozinho pelo 4G em 5s |
| ~39s sem rede | conexão aberta 0,8s depois do evento `online` |

## Decisão

O SSE fica (D-046 confirmada). O adaptador de consulta condicional não é necessário e não foi
construído. O desenho do adaptador real incorpora o que a medição mostrou:

- **Batimento é evento, não comentário.** `EventSource` não entrega `: ping` ao JavaScript, então
  o vigia do cliente não o veria e reconectaria a cada 45s com o mural parado. `event: ping` a
  cada 15s mantém a borda acordada (corte aos 126s) e alimenta o vigia.
- **Reconectar é caminho feliz.** O túnel derruba streams em rajadas e o iOS mata a conexão em
  segundo plano sempre. Nenhuma das duas coisas é erro a reportar.
- **Ao voltar, duvidar.** Conexão que se diz `open` tem 3s para provar que vive; se der erro nesse
  prazo, reconecta na hora. Se já estiver reconectando (vigia ou navegador), não se mexe.
- **Rajada ao acordar vale um sinal só.** Os eventos represados são velhos; importa a última
  revisão, e a busca ao focar (D-048) já cobre o resto.

## Alternativas descartadas

- **Consulta condicional (ETag, 304).** Era o plano B para o caso de buffer; não houve buffer.
- **Manter a conexão viva em segundo plano.** O iOS não permite a uma página; insistir seria gambiarra.

## Consequências

- O embrião do adaptador está em `web/src/shared/adapters/resilient-event-source.ts`; a rota e a
  página de diagnóstico são removíveis e ficam ligadas até o passo do PWA.
- **Não medido:** modo instalado na tela de início (`standalone`). Repetir o roteiro quando o PWA
  existir; o WebKit é o mesmo, mas o ciclo de vida do app instalado pode diferir.
- Não medido: HTTP/2 visto de dentro do Safari (inferido do ALPN da borda) e o teto de descritores
  do container, que é o primeiro limite real antes de centenas de conexões simultâneas.
