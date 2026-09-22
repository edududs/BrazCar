# Deploy

O que foi feito de verdade no primeiro deploy (2026-09-21). API na máquina de teste
`trovva-internal` (acesso só por Tailscale), front no Vercel (D-060).

## Peças

| Peça | Onde |
|---|---|
| Imagem da API | `ghcr.io/edududs/brazcar-api`, pública. Tag `vX.Y.Z` publica a versão e `latest`; disparo manual do fluxo `image` publica `edge` |
| Compose | `infra/compose.yml` do repo, copiado para `~/brazcar/compose.yml` na máquina |
| Ambiente | `~/.brazcar/api.env` na máquina, modo 600, fora do repo. Modelo: `infra/api.env.example`. Os segredos foram gerados lá com `openssl rand` e nunca saíram da máquina |
| Dados | volume `brazcar-postgres-data` |
| Túnel | entrada `api-brazcar.elj-labs.org` em `/etc/cloudflared/config.yml`; CNAME com proxy para `<id do túnel>.cfargotunnel.com` |
| Front | projeto `braz-car` no Vercel, raiz `web/`, `VITE_API_BASE_URL=https://api-brazcar.elj-labs.org`; CNAME `brazcar` **sem** proxy para o alvo que o Vercel indica. Push no `main` publica |

## Atualizar a API

```bash
# publicar: criar tag vX.Y.Z, ou `gh workflow run image --ref main` para a tag edge
ssh trovva@trovva-internal
export DOCKER_CONFIG=~/.brazcar/docker && mkdir -p "$DOCKER_CONFIG"   # vazio de propósito: pull anônimo (D-081)
docker pull ghcr.io/edududs/brazcar-api:edge
cd ~/brazcar && BRAZCAR_IMAGE_TAG=edge docker compose up -d
docker compose ps          # esperar (healthy)
curl -s -H "Host: api-brazcar.elj-labs.org" http://127.0.0.1/api/health
```

A migração e o `sync_places` do catálogo de lugares rodam no entrypoint da API (`RUN_MIGRATIONS=1`, D-061 e D-087).

## Armadilhas já pagas

- **Pull negado.** O `~/.docker/config.json` do usuário tem um login de `ghcr.io` de outro projeto, e o
  registro responde `denied` mesmo com a imagem pública. Por isso o BrazCar usa um `DOCKER_CONFIG`
  próprio e vazio em `~/.brazcar/docker`, que puxa como anônimo sem tocar no login dos outros (D-081).
  Não é preciso token. Só se a imagem virar privada: token clássico com `read:packages` e
  `docker login ghcr.io --password-stdin` nesse mesmo diretório.
- **Container que nunca fica saudável não é roteado.** O Traefik ignora container `unhealthy`, e o
  sintoma é 404 do Traefik, não erro da API. O healthcheck da imagem se apresenta com o primeiro
  host de `DJANGO_ALLOWED_HOSTS`, porque o Django recusa `127.0.0.1` com debug desligado.
- **Túnel.** Mudou o `config.yml`: backup, `cloudflared tunnel --config <arquivo> ingress validate`,
  e `sudo systemctl restart cloudflared`. **Nunca** `systemctl kill -s HUP cloudflared`: derruba o
  túnel e ele não volta sozinho. O restart tira do ar por alguns segundos todos os endereços do
  túnel (Trovva, JayceFinance): escolher a hora e conferir depois que voltaram.
- **DNS do túnel.** `cloudflared tunnel route dns` não funciona na máquina (não há `cert.pem`).
  O CNAME se cria no painel ou pela API do Cloudflare.
- **Zona diferente.** O curinga do túnel é de `trovva.net`; endereço de `elj-labs.org` precisa de
  entrada explícita no ingress (ADR-0012).

## Rota de diagnóstico de SSE

Ligada enquanto `SSE_DIAGNOSTICS_TOKEN` existir no `api.env`. Para desligar: apagar a linha e
`docker compose up -d`. Ler o token: `grep SSE_DIAGNOSTICS_TOKEN ~/.brazcar/api.env` na máquina.
