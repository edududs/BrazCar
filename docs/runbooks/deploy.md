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
`WEB_MINIMUM_VERSION` a API serve sem piso. Em 2026-09-24 (v0.11.0) nada entrou no `api.env`; a
migração `0003` aplicou no `up`. Em 2026-09-24 (v0.12.0) entrou `EMAIL_*` no `api.env` (SMTP do
Resend, chave fora do repo): a recuperação de senha passa a mandar e-mail de verdade; sem migração.
Em 2026-09-24 (v0.12.1) nada entrou no `api.env`; sem migração.
O disparo de teste no deploy não deixou linha de erro de SMTP no log da API.
As migrações `importing.0003` e `rides.0004` (D-138) põem o nono dígito nos telefones gravados com
o endereço antigo do WhatsApp; rodam no entrypoint da API com `RUN_MIGRATIONS=1`, e o operador
confere no log uma linha `ninth digit (D-138)` por coluna, com zero ilegíveis
(`docker compose logs api --since 3m | grep "ninth digit"`).
Em 2026-09-24 (v0.13.0) nada entrou no `api.env`; as migrações de dados `importing.0003` e
`rides.0004` (D-138) rodaram no `up` com 0 ilegíveis, corrigindo 20 telefones em
`importing_candidate.sender_phone`, 20 em `importing_source_message.sender_phone`, 1 em
`importing_source_message.account` e 6 em `rides_ride.driver_phone`.
Em 2026-09-24 (v0.14.0) nada entrou no `api.env`; sem migração.
A migração `rides.0005` (D-140) preenche os registros de `ContactRequest` já existentes a partir
da carona ainda gravada; o operador confere no log a linha `rides_contact_request: filled N row(s)`.
Em 2026-09-25 (v0.15.0) nada entrou no `api.env`; a migração `rides.0005` (D-140) preencheu 2
pedidos de contato no `up`. Em 2026-09-25 (v0.16.0) nada entrou no `api.env`; sem migração; a
fonte hospedada responde em `/fonts/...` pelo Vercel. Em 2026-09-25 (v0.17.0) nada entrou no
`api.env`; sem migração; ícones novos do app servidos pelo Vercel. Em 2026-09-25 (v0.18.0) nada
entrou no `api.env`; sem migração. Em 2026-09-25 (v0.20.2) nada entrou no `api.env`; sem migração.
Em 2026-09-25 (v0.21.0) nada entrou no `api.env`; a migração `feedback.0001` criou a tabela do
canal de opinião no `up`. Em 2026-09-26 (v0.21.2) nada entrou no `api.env`; sem migração.

## Worker do WhatsApp (passo 7a)

O serviço `worker` roda `manage.py run_extractor` na imagem da API, um processo para uma conta (D-108).
Feito assim em 2026-09-24 (v0.8.0), cada passo com ok do Eduardo:

```bash
ssh trovva@trovva-internal && cd ~/brazcar
# 1. Papel e schema da sessão do WhatsApp (D-040), uma vez por servidor; a senha vai para o api.env.
#    O arquivo é infra/postgres/whatsapp-role.sql do repo, copiado para ~/brazcar como o compose.
docker compose exec -T postgres psql -U brazcar -d brazcar -v password='<senha>' -f - < whatsapp-role.sql
# 2. api.env: WHATSAPP_SESSION_DSN (com ?sslmode=disable), IMPORT_PURGE=pg_cron, IMPORT_RAW_RETENTION_HOURS.
#    WHATSAPP_ACCOUNT e WHATSAPP_GROUPS ficam vazios até os passos 3 e 4.
# 3. Pareamento: o QR aparece no terminal; ler com WhatsApp > Aparelhos conectados. Depois, WHATSAPP_ACCOUNT=<telefone>.
#    Num terminal de verdade, monoespaçado, com uns 70x40: dentro de outra ferramenta o QR sai desproporcional.
#    Um `run` abandonado fica vivo esperando o QR: `docker ps` e `docker rm -f` antes de tentar de novo.
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

Feito assim em 2026-09-24 (v0.9.0), com `api.env.bak-v0.8.0` guardando o anterior. Da v0.9.0 (7b) em diante o worker também julga: `OLLAMA_BASE_URL=http://host.docker.internal:11434`,
`RIDE_PARSER_MODEL` (o que passou no golden set) e `IMPORT_ACCEPT_THRESHOLD` no `api.env`; o job
de poda ganhou a regra inteira, então `install_purge_schedule` roda de novo na troca de versão.
Para olhar: `manage.py candidates` (julgamentos e motivos), `manage.py import_rides` (uma varredura
à mão; com `--rejudge` relê o dia de hoje, D-130), `manage.py block_sender <telefone>` (quem pediu para sair, D-119).

Grupo novo: editar `WHATSAPP_GROUPS` e `docker compose up -d worker`. O worker não migra (`RUN_MIGRATIONS`
só na API) e espera a API ficar saudável. Trocar a imagem do Postgres pela que tem `pg_cron` mantém o
volume: é a mesma base, `18-alpine`, com a extensão copiada para dentro.

## Armadilhas já pagas

- **Pull negado.** O `~/.docker/config.json` do usuário tem um login de `ghcr.io` de outro projeto, e o
  registro responde `denied` mesmo com a imagem pública. Por isso o BrazCar usa um `DOCKER_CONFIG`
  próprio e vazio em `~/.brazcar/docker`, que puxa como anônimo sem tocar no login dos outros (D-081).
  Não é preciso token. Só se a imagem virar privada: token clássico com `read:packages` e
  `docker login ghcr.io --password-stdin` nesse mesmo diretório. O `DOCKER_CONFIG` precisa estar
  exportado no mesmo shell do `docker compose up` (ou `pull`), não só de um comando anterior: cada
  chamada de `ssh` abre um shell novo, então `export` num comando e `docker compose up` no
  seguinte perde a variável e volta a usar o login de outro projeto (aconteceu em 2026-09-24, no
  deploy da v0.11.0).
- **Container que nunca fica saudável não é roteado.** O Traefik ignora container `unhealthy`, e o
  sintoma é 404 do Traefik, não erro da API. O healthcheck da imagem se apresenta com o primeiro
  host de `DJANGO_ALLOWED_HOSTS`, porque o Django recusa `127.0.0.1` com debug desligado.
- **Túnel.** Mudou o `config.yml`: backup, `cloudflared tunnel --config <arquivo> ingress validate`,
  e `sudo systemctl restart cloudflared`. **Nunca** `systemctl kill -s HUP cloudflared`: derruba o
  túnel e ele não volta sozinho. O restart tira do ar por alguns segundos todos os endereços do
  túnel (Trovva, JayceFinance): escolher a hora e conferir depois que voltaram.
- **DNS do túnel.** `cloudflared tunnel route dns` não funciona na máquina (não há `cert.pem`).
  O CNAME se cria no painel ou pela API do Cloudflare.
- **`scp` com dois pares origem e destino.** `scp a host:a b host:b` manda `a`, `host:a` e `b` para
  `host:b`, que vira um diretório com cópias dentro. Um `scp a b host:dir/` por vez.
- **Aviso de `ffmpeg` no worker.** O neonize avisa que não há `ffmpeg` no PATH; só importa para mídia,
  que o `DjangoStore` descarta (D-111). Ignorar.
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

## Convites

`INVITE_LINK` no `api.env` (modelo em `infra/api.env.example`) diz para onde aponta o link que o
comando de convite imprime (D-166). Precisa entrar antes do `up -d` da versão que traz o convite:
sem ela, o comando imprime link de `localhost`. Para convidar alguém:

```bash
docker compose exec api python manage.py invite <celular>             # vale 4 horas
docker compose exec api python manage.py invite <celular> --hours 12  # outro prazo
```

A primeira linha da saída é o link, para colar na conversa com a pessoa; a segunda diz até quando
ele vale, no horário de Brasília. Emitir de novo para o mesmo celular invalida o link anterior.
