# Deploy

O que foi feito de verdade no primeiro deploy (2026-09-21). API na máquina de teste
`trovva-internal` (acesso só por Tailscale), front no Vercel (D-060).

## Peças

| Peça | Onde |
|---|---|
| Imagem da API | `ghcr.io/edududs/brazcar-api`, pública. A tag git `vX.Y.Z` publica a imagem `X.Y.Z` (**sem o `v`**) e `latest`; disparo manual do fluxo `image` publica `edge` |
| Imagem do Postgres | `ghcr.io/edududs/brazcar-postgres`, a oficial `18-alpine` mais `pg_cron` (`infra/postgres`), publicada pela mesma tag da API (D-119) |
| Compose | `infra/compose.yml` do repo, copiado para `~/brazcar/compose.yml` na máquina: serviços `api`, `worker` e `postgres` |
| Ambiente | `~/.brazcar/api.env` na máquina, modo 600, fora do repo. Modelo: `infra/api.env.example`. Os segredos foram gerados lá com `openssl rand` e nunca saíram da máquina |
| Dados | volume `brazcar-postgres-data` |
| Túnel | entrada `api-brazcar.elj-labs.org` em `/etc/cloudflared/config.yml`; CNAME com proxy para `<id do túnel>.cfargotunnel.com` |
| Front | projeto `braz-car` no Vercel, raiz `web/`, `VITE_API_BASE_URL=https://api-brazcar.elj-labs.org`; CNAME `brazcar` **sem** proxy para o alvo que o Vercel indica. Push no `main` publica |

## Atualizar a API

```bash
# publicar: push da tag vX.Y.Z (fluxo `image`), ou `gh workflow run image --ref main` para a tag edge
ssh trovva@trovva-internal
export DOCKER_CONFIG=~/.brazcar/docker && mkdir -p "$DOCKER_CONFIG"   # vazio de propósito: pull anônimo (D-081)
docker pull ghcr.io/edududs/brazcar-api:0.7.0                          # a imagem não tem o `v`
cd ~/brazcar && BRAZCAR_IMAGE_TAG=0.7.0 docker compose up -d --wait
docker compose logs api --since 3m | grep -E "Applying|places:|rides:" # migrações, catálogo e índice de busca
curl -s -N --max-time 4 https://api-brazcar.elj-labs.org/api/rides/signal   # quadro `revision` na hora
curl -s -H "Host: api-brazcar.elj-labs.org" http://127.0.0.1/api/health
```

A migração, o `sync_places` do catálogo e o `index_rides` da busca (D-100) rodam no entrypoint da API (`RUN_MIGRATIONS=1`, D-061 e D-087).
Variável nova no `api.env` entra antes do `up -d`; o modelo é `infra/api.env.example`. Em
2026-09-22 (v0.4.0) entrou `PASSWORD_RESET_LINK`; `EMAIL_*` ficou de fora até haver a chave do
Resend, então o e-mail de recuperação vai para o log do container. Em 2026-09-22 (v0.5.0) nada entrou:
os limites de `rides` (`RIDE_*`) têm padrão no código. Em 2026-09-23 (v0.7.0) também nada: sem
`WEB_MINIMUM_VERSION` a API serve sem piso.

## Worker do WhatsApp (passo 7a)

O serviço `worker` roda `manage.py run_extractor` na imagem da API, um processo para uma conta (D-108).
Ordem na primeira vez, cada passo com ok do Eduardo:

```bash
ssh trovva@trovva-internal && cd ~/brazcar
# 1. Papel e schema da sessão do WhatsApp (D-040), uma vez por servidor; a senha vai para o api.env.
#    O arquivo é infra/postgres/whatsapp-role.sql do repo, copiado para ~/brazcar como o compose.
docker compose exec -T postgres psql -U brazcar -d brazcar -v password='<senha>' -f - < whatsapp-role.sql
# 2. api.env: WHATSAPP_SESSION_DSN (com ?sslmode=disable), IMPORT_PURGE=pg_cron, IMPORT_RAW_RETENTION_HOURS.
#    WHATSAPP_ACCOUNT e WHATSAPP_GROUPS ficam vazios até os passos 3 e 4.
# 3. Pareamento: o QR aparece no terminal; ler com WhatsApp > Aparelhos conectados. Depois, WHATSAPP_ACCOUNT=<telefone>.
docker compose run --rm worker python manage.py pair_whatsapp
# 4. Grupos: copiar os JIDs aprovados para WHATSAPP_GROUPS=jid=rótulo;jid=rótulo (D-109).
docker compose run --rm worker python manage.py list_whatsapp_groups
# 5. A poda dentro do Postgres, uma vez por banco (e de novo se a retenção mudar).
docker compose run --rm worker python manage.py install_purge_schedule
# 6. Subir e conferir.
BRAZCAR_IMAGE_TAG=<versão> docker compose up -d --wait
docker compose logs worker --since 2m           # "extractor: account ..., N group(s), purge by pg_cron"
docker compose run --rm worker python manage.py source_messages --last 5
docker compose exec postgres psql -U brazcar -d brazcar -c "select jobname, schedule from cron.job"
```

Grupo novo: editar `WHATSAPP_GROUPS` e `docker compose up -d worker`. O worker não migra (`RUN_MIGRATIONS`
só na API) e espera a API ficar saudável. Trocar a imagem do Postgres pela que tem `pg_cron` mantém o
volume: é a mesma base, `18-alpine`, com a extensão copiada para dentro.

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
- **DSN do neonize sem `sslmode`.** O driver Go exige TLS por padrão e falha com um erro opaco
  (`not enough values to unpack`) contra o Postgres interno, que não tem TLS. `?sslmode=disable` na
  `WHATSAPP_SESSION_DSN` resolve; a API, por `psycopg`, não tem esse problema.
- **Zona diferente.** O curinga do túnel é de `trovva.net`; endereço de `elj-labs.org` precisa de
  entrada explícita no ingress (ADR-0012).

## Rota de diagnóstico de SSE

Fica ligada de propósito (D-107). A página é `/diagnostics`, sem link na interface: digitar o
endereço e colar o token no campo. Ligada enquanto `SSE_DIAGNOSTICS_TOKEN` existir no `api.env`. Para desligar: apagar a linha e
`docker compose up -d`. Ler o token: `grep SSE_DIAGNOSTICS_TOKEN ~/.brazcar/api.env` na máquina.

## Piso de versão do front

`WEB_MINIMUM_VERSION` no `api.env` (`MAJOR.MINOR.PATCH`; ausente ou `0.0.0` é sem piso, D-105).
Subir só quando uma versão da API quebrar o front antigo: quem estiver abaixo vê a tela de
atualização obrigatória. Valor malformado impede a API de subir. Depois de mudar,
`docker compose up -d` e conferir `curl https://api-brazcar.elj-labs.org/api/web-version`.
