# Passo 7 — extrator embutido e contexto `importing` (em andamento; apagar ao fechar)

Dois releases: **7a** prova o extrator em produção com mensagens cruas fluindo; **7b** transforma
mensagem em carona no mural. Decisões: D-108 a D-123, ADR-0015 e ADR-0016. Glossário em
[domain/importing.md](../../domain/importing.md).

## 7a — extrator embutido

- A1. Dependência do extrator (`whatsapp-extractor` v0.2.1, por git) instalada no backend em
  Python 3.14 (D-070). Se o neonize não subir em 3.14, registrar e decidir antes de descer (D-070).
- A2. `DjangoStore` implementa `MessageWriter.save` (D-042): grava só texto de grupo observado, não
  vazio, não `from_me`, em colunas tipadas; único por (conta, id); idempotente (D-111). Ignora o
  resto sem erro. Contrato no fake, em SQLite e em Postgres.
- A3. `manage.py run_extractor`: monta as `Settings` do extrator a partir das variáveis
  `WHATSAPP_ACCOUNT`, `WHATSAPP_SESSION_DSN` e `WHATSAPP_GROUPS` (JID=rótulo, D-109), roda
  `bootstrap.run` com o `DjangoStore` como `writer` e um handler que só acorda a tarefa de varredura
  (D-112). Logs JSON como a API. Sai com erro claro se a conta não está pareada.
- A4. `manage.py pair_whatsapp`: pareia uma vez, QR no terminal, sessão no banco da DSN.
  `manage.py list_whatsapp_groups`: lista os JIDs da conta para montar a lista (D-109).
- A5. Poda (D-119) como porta com dois adaptadores já em 7a, com a regra deste release: mensagem-fonte
  com mais de `IMPORT_RAW_RETENTION_HOURS` (24) é apagada. `IMPORT_PURGE=worker` varre no processo;
  `IMPORT_PURGE=pg_cron` instala o job por `manage.py install_purge_schedule`. Contrato provando que
  os dois apagam o mesmo.
- A6. Admin do Django somente leitura para mensagens-fonte (D-087), atrás de `accounts`.
- A7. `infra/compose.yml`: serviço `worker` (D-108), mesma imagem, sem `RUN_MIGRATIONS`,
  `extra_hosts` para `host.docker.internal`, espera a API. Postgres com `pg_cron` se a extensão
  couber na imagem oficial ou numa imagem própria publicada como a da API; senão `IMPORT_PURGE=worker`
  na máquina e registro do motivo. Variáveis novas no `infra/api.env.example`.
- A8. D-040 testado na máquina: usuário `brazcar_wa` com schema e `search_path` próprios para as
  tabelas `whatsmeow_*`; a DSN do worker aponta para ele. Passa a `decidido` ou é substituída.
- A9. Deploy com ok explícito do Eduardo em cada passo: usuário de banco, env, pareamento, lista de
  grupos aprovada, `up -d`. Verificado: mensagens reais na tabela, worker sobrevivendo a restart,
  poda rodando. Runbook atualizado com o que foi feito de fato.

## 7b — importação

- B1. `rides`: `driver` e `origin` como tipos-soma (ADR-0015); publicar pela API exige
  `RegisteredDriver`; ações de dono nunca para `ExternalDriver`; contato devolve `wa.me` do
  remetente sem placa; `RideOut` ganha `origin` e carro opcional, sem telefone. Repositório com
  `delete` e busca por remetente e partida. Migração. Tolerância padrão 10 min (D-121).
- B2. Catálogo com os bairros de Brazlândia e os pontos de Brasília dos grupos (D-122).
- B3. `importing` domínio: `Candidate` com `Verdict`, `TextKey`, `Judgement`, `Checks` e confiança,
  `resolve_departure`, regra de aceite com padrões (D-116). Só stdlib e Pydantic; testes puros,
  Hypothesis na chave de texto e na resolução de horário.
- B4. Portas e casos de uso: `IngestMessage` (mensagem-fonte → candidata, idempotente, junção por
  janela), `JudgeCandidate` (parser → resolução → aceite → carona por porta, junção por partida),
  `BlockSender`, `PurgeImported` (regra completa de D-119). `RideParser`, `StopResolver`,
  `ImportedRides`, `BlockedSenders`, `Purge`.
- B5. Adaptadores: repositórios (contrato nos dois bancos), parser Ollama por `httpx` com schema
  derivado do `ParserOutput`, fake determinístico, poda com a regra completa nos dois adaptadores,
  consumidor no `run_extractor`, `manage.py import_rides` (uma passada, para reprocessar),
  `manage.py block_sender`, admin somente leitura de candidatas.
- B6. Golden set (D-120): a amostra anonimizada do levantamento, com julgamento esperado, em
  `backend/tests/importing/golden/`; task `poe test-golden` no portão pesado quando
  `OLLAMA_BASE_URL` existe; relatório de acerto e latência por modelo.
- B7. Front: selo "via WhatsApp" no card, carro opcional, detalhe com texto original, rótulo do grupo
  e enviada em; contato sem placa. Sem ações de dono. Tipos regenerados do OpenAPI. Visual padrão (D-103).
- B8. Deploy com ok explícito: modelo escolhido baixado no Ollama, `OLLAMA_BASE_URL`,
  `IMPORT_ACCEPT_THRESHOLD`; verificado no mural publicado e no celular.

## Fora

Atualização por mensagem posterior (D-118), reivindicação (D-034), fila de revisão, pedidos de
passageiro (D-010), autocomplete no formulário (D-123, etapa de design), mídia.
