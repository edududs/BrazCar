# Teste de risco: SSE pelo túnel do Cloudflare

Efêmero (passo 2, D-049). Ao fechar, o essencial vira uma linha em `decisions/README.md`,
`runbooks/deploy.md` e `STATE.md`, e esta pasta é apagada. Resultados em [results.md](results.md).

## Pergunta

Uma conexão SSE sobrevive ao caminho real (navegador → Cloudflare → túnel nomeado → Traefik em
HTTP → uvicorn) sem buffer e com comportamento aceitável num iPhone? O resultado decide se o
adaptador SSE de D-046 vale ou se entra a consulta condicional (ETag, 304) atrás da mesma porta.

## O que foi construído

- **Rota de diagnóstico** `GET /api/diagnostics/sse?token=…` em `shared/adapters/sse_diagnostics.py`.
  Desligada sem `SSE_DIAGNOSTICS_TOKEN`; fora do contrato OpenAPI; não toca o ORM. Parâmetros:
  `tick_seconds` (padrão 1, 0 desliga), `heartbeat_seconds` (padrão 15, 0 desliga) e
  `heartbeat_kind` (`comment` ou `event`). Os dois em 0 dão conexão muda, para ver quem corta.
- **`shared/adapters/sse.py`**: formato dos quadros e a resposta com `Cache-Control: no-cache,
  no-transform` e `X-Accel-Buffering: no`. Fica para o adaptador real.
- **CORS por ambiente** (`DJANGO_CORS_ALLOWED_ORIGINS`), com credenciais, via `django-cors-headers`.
  Adianta a parte de D-059 que o teste precisa; cookie e checagem de `Origin` seguem em `accounts`.
- **`web/src/shared/adapters/resilient-event-source.ts`**: embrião do adaptador real. Vigia de
  silêncio, reconexão quando o navegador desiste, e ao voltar ao foco ou à rede a conexão é posta
  em dúvida: se nenhum evento chegar no prazo de graça (3s), reconecta. É isso que mede se o
  `readyState` mente.
- **Página `/diagnostics?token=…`**: estatísticas (atraso, jitter, intervalos, rajadas, travadas,
  perdidos, tempo até o primeiro evento), registro de cada evento e de cada transição
  (`visibilitychange`, `online`, `offline`, `pageshow`, `pagehide`), botões de marcar momento,
  compartilhar e copiar o log.
- **Imagem** (`backend/Dockerfile`), `infra/compose.yml`, `.github/workflows/image.yml` e
  `backend/scripts/sse_idle_connections.py` (N conexões abertas, só biblioteca padrão).

**uvicorn, não granian:** já é o servidor de desenvolvimento e o que os logs JSON conhecem;
conexões SSE ociosas são tarefas asyncio paradas, onde o laço de E/S em Rust do granian não traz
ganho que se meça aqui. Um processo só, porque o sinal do mural é uma tarefa por processo web
(ADR-0010). Se a medição 6 mostrar custo alto, reabre-se a escolha com número na mão.

## Achado antes de publicar

`EventSource` não entrega comentários (`: ping`) ao JavaScript. O batimento em comentário mantém
os proxies acordados, mas o vigia do cliente não o enxerga: com o mural parado, reconectaria a
cada 45s à toa. Conferido localmente (vigia de 5s, batimento em comentário a cada 2s, reconexão
por silêncio a cada 5s). O adaptador real precisa de batimento como **evento** (`event: ping`).
A rota aceita os dois modos para medir ambos pelo túnel.

## Infra proposta (nada aplicado; cada item espera o ok do Eduardo)

Estado lido em 2026-09-21 na trovva-internal, só leitura: Docker 29.5.2, Compose 5.1.4, 7,8 GB de
RAM com 5,8 GB disponíveis, 154 GB livres, rede `web` existente, Traefik v3 em `127.0.0.1:80` sem
middleware de compressão, cloudflared 2026.5.0 ativo, login no `ghcr.io` presente.

1. **Imagem.** Push do `main` e disparo manual do fluxo `image` publica `ghcr.io/edududs/brazcar-api:edge`.
2. **Ambiente.** `~/.brazcar/api.env` na máquina (modelo em `infra/api.env.example`), modo 600.
   Quem preenche os segredos é o Eduardo.
3. **Subida.** Copiar `infra/compose.yml` para `~/brazcar/` e `BRAZCAR_IMAGE_TAG=edge docker compose up -d`.
   Só cria containers, rede `brazcar_internal` e volume novos; não toca serviço de outro projeto.
4. **Túnel.** Em `/etc/cloudflared/config.yml`, antes do fallback 404:

   ```diff
      - hostname: api.financas.elj-labs.org
        service: http://localhost:80
   +  # BrazCar (elj-labs.org): mesma regra, hostname explicito.
   +  - hostname: api-brazcar.elj-labs.org
   +    service: http://localhost:80
      # Fallback obrigatorio (host desconhecido -> 404)
   ```

   Com backup antes, `cloudflared tunnel ingress validate`, e `sudo systemctl restart cloudflared`
   (o procedimento do README do Trovva). **Nunca** `systemctl kill -s HUP`. O restart derruba por
   alguns segundos todos os endereços do túnel, inclusive Trovva e JayceFinance: escolher a hora.
5. **DNS.** `cloudflared tunnel route dns trovva-internal api-brazcar.elj-labs.org` (CNAME com proxy).
6. **Front.** Projeto no Vercel com raiz `web/`, `VITE_API_BASE_URL=https://api-brazcar.elj-labs.org`
   e o domínio `brazcar.elj-labs.org` (CNAME para o Vercel, **sem** proxy do Cloudflare). É a opção
   recomendada, porque vale para o cookie de D-059. Alternativa mais barata: página servida
   localmente, com a origem usada em `DJANGO_CORS_ALLOWED_ORIGINS`.

## Medições

| # | O quê | Como |
|---|---|---|
| 1 | Um a um ou em rajada | Página e `curl -N` pelo túnel. Sem o Cloudflare: o Traefik só escuta em `127.0.0.1`, então a comparação é por `ssh -L 8081:127.0.0.1:80` e `curl -H "Host: api-brazcar.elj-labs.org"` |
| 2 | Primeiro evento, atraso médio e máximo | Página (o atraso bruto inclui a diferença de relógio; o jitter a desconta) |
| 3 | Sobrevida da conexão ociosa | `tick_seconds=0` com batimento a cada 15s por 10 min; depois os dois em 0 para ver o corte (~100s esperado) |
| 4 | HTTP/2 até o Cloudflare | `curl -sI --http2 -w '%{http_version}'` e o DevTools do Chrome |
| 5 | iPhone | Roteiro abaixo |
| 6 | Custo de 20 e 100 conexões | `sse_idle_connections.py` pelo túnel; `docker stats` e `ls /proc/1/fd \| wc -l` no container |

## Roteiro do iPhone (Eduardo)

Abrir `https://brazcar.elj-labs.org/diagnostics?token=<token>&heartbeatKind=event`. Antes de cada
passo, tocar em **Marcar momento**; a marca numerada é o que liga o log ao passo. Wi-Fi ligado.

1. Safari em primeiro plano, 2 min parado. (marca 1)
2. Marcar, bloquear a tela 30s, desbloquear, esperar 10s. (marca 2)
3. Marcar, bloquear 2 min, desbloquear, esperar 10s. (marca 3)
4. Marcar, bloquear 10 min, desbloquear, esperar 10s. (marca 4)
5. Marcar, trocar para outro app por 1 min, voltar, esperar 10s. (marca 5)
6. Marcar, desligar o Wi-Fi (cai no 4G), esperar 30s, religar o Wi-Fi, esperar 30s. (marca 6)
7. **Compartilhar log** e mandar para si mesmo (AirDrop, Notas, e-mail). Colar na sessão.
8. Compartilhar → **Adicionar à Tela de Início**, abrir pelo ícone (o campo "modo" deve mostrar
   `standalone`) e repetir os passos 1 a 7.

Se sobrar tempo: repetir o passo 3 com `&heartbeatKind=comment&tickSeconds=0` (o caso do mural
parado com batimento invisível).
