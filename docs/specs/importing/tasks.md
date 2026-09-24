# Tarefas (em andamento; apagar ao fechar)

Cada tarefa fecha com `uv run poe fix` (e `yarn fix` quando toca o front) e um commit próprio.
Nada na máquina de teste sem ok explícito do Eduardo. Marcar `[x]` ao fechar.

## 7a — extrator embutido (release próprio)

- [x] T1. Dependência do extrator por git (tag `v0.2.1`) no `backend/pyproject.toml`; `uv sync`;
  prova de importação e de `NewAClient` em Python 3.14. Registrar o resultado (D-070).
- [x] T2. App `importing` com `SourceMessageModel` e migração; `DjangoStore` com o filtro de D-111;
  contrato `MessageWriter` em `tests/contracts/` (fake, SQLite, Postgres): idempotência por
  (conta, id), descarte de mídia, vazio, `from_me` e grupo fora da lista.
- [x] T3. Settings: `WHATSAPP_*`, `IMPORT_PURGE`, `IMPORT_RAW_RETENTION_HOURS`; parser de
  `WHATSAPP_GROUPS` (`jid=rótulo;...`) com teste.
- [x] T4. Comandos `pair_whatsapp`, `list_whatsapp_groups`, `run_extractor` (bootstrap + handler que
  acorda + varredura); teste do laço com fonte fake do extrator.
- [x] T5. Porta `Purge` com `WorkerPurge` e `PgCronPurge` (`install_purge_schedule`); contrato no
  Postgres provando o mesmo resultado; regra de 7a (retenção de mensagem crua).
- [x] T6. ~~Admin somente leitura~~ `manage.py source_messages` (D-124).
- [x] T7. `infra/compose.yml`: serviço `worker`; Postgres com `pg_cron` em imagem própria
  (`infra/postgres`, fluxo `image` publica `brazcar-postgres`); `infra/api.env.example` com as variáveis
  novas. Provado local: build da API com git e libmagic, comandos do worker rodando no container em
  3.14.7, job do pg_cron executando no Postgres de dev, papel de D-040 criando as tabelas no schema `whatsapp`.
- [ ] T8. Na máquina, com ok em cada passo: usuário e schema de D-040; env; `pair_whatsapp`;
  `list_whatsapp_groups` → lista aprovada → `WHATSAPP_GROUPS`; `up -d`; conferir mensagens na
  tabela, restart do worker, poda. Runbook `deploy.md` com o feito de fato; D-040 decidida ou substituída.
- [ ] T9. Fechar por `close-step.md`: docs, versão, relato com verificado x não verificado. Parar antes do push.

## 7b — importação (release próprio)

- [x] T10. `rides` domínio: `Driver`, `RideOrigin`, `import_offer`, ações, contato sem placa;
  testes puros e Hypothesis existentes ainda verdes.
- [x] T11. `rides` adaptadores: migração, `from_row`/`to_row` dos tipos-soma, `delete`,
  `by_external_departure`, `RideOut`/`RideDetailOut`, contrato nos dois bancos; tolerância 10 min.
- [x] T12. Catálogo: bairros de Brazlândia e pontos de Brasília com apelidos (D-122); `sync_places`.
- [x] T13. `importing` domínio: `text_key`, `Candidate`/`Verdict`, `Judgement`, `Checks`/confiança,
  `resolve_departure`, `decide`; testes puros, Hypothesis em `text_key` e `resolve_departure`.
- [x] T14. Portas e casos de uso (`IngestMessage`, `JudgeCandidate`, `BlockSender`, `PurgeImported`)
  com fakes; testes de idempotência: mensagem repetida, candidata repetida, repostagem por partida.
- [x] T15. Adaptadores: repositórios e contratos; `StopResolver` sobre o catálogo; `ImportedRides`
  sobre `rides`; `OllamaRideParser` (httpx, schema, few-shot) e `FakeRideParser`; poda completa nos
  dois adaptadores; consumidor no `run_extractor`; `import_rides`, `block_sender`; admin de candidatas.
- [~] T16. Golden set (rotulado e versionado; falta medir na máquina): converter a amostra anonimizada em `tests/importing/golden/*.jsonl` com
  julgamento esperado; `poe test-golden`; medir gemma3:4b e qwen3.5:4b (acerto e latência) na
  máquina com ok; escolher o modelo e registrar.
- [x] T17. Front: selo, carro opcional, bloco da mensagem original, contato sem placa; tipos do
  OpenAPI; testes dos hooks tocados.
- [ ] T18. Deploy com ok: modelo baixado, env, `up -d`; verificar carona importada no mural
  publicado e no celular; runbook.
- [ ] T19. Fechar por `close-step.md`; apagar `docs/specs/importing/`; STATE, ROADMAP, arquitetura.
