# Desenho (em andamento; apagar ao fechar)

## `rides` (7b)

- `Driver` é tipo-soma por `kind`: `RegisteredDriver(account_id, car: CarSnapshot)` |
  `ExternalDriver(phone: PhoneNumber, display_name)`. `RideOrigin` idem: `PublishedOrigin` |
  `WhatsAppOrigin(message_text, group_label, sent_at)`.
- `RideOffer.publish(...)` continua para a API (exige `RegisteredDriver`). `RideOffer.import_offer(
  driver: ExternalDriver, origin: WhatsAppOrigin, route, departure_at, seats, price, payment, now)`
  cria a importada; emite `RidePublished` como qualquer outra.
- `allowed_actions`: `viewer == driver.account_id` só existe para `RegisteredDriver`; externa nunca
  tem `can_edit`, `can_change_seats`, `can_cancel`, `can_repeat`. `can_contact` como hoje.
- `RequestContact`: devolve `ContactInfo(link, plate: str | None)`; para externa o telefone é o do
  `ExternalDriver`, sem passar pelo `DriverDirectory`.
- `RideRepository` ganha `delete(ride_id)` e `by_external_departure(phone, departure_at)`.
- Tabela: `driver_account_id` e `car_*` nuláveis, `driver_phone`, `driver_name`, `origin_kind`,
  `origin_text`, `origin_group_label`, `origin_sent_at`. O `from_row` monta o tipo-soma; linha com
  as duas formas ou nenhuma é erro de dado, não estado.
- `RideOut`: `driver_name`, `car: {model, color} | None`, `origin: "published" | "whatsapp"`;
  `RideDetailOut` acrescenta `origin_message: {text, group_label, sent_at} | None`.

## `importing` domínio (7b)

- `SourceMessage(account, message_id, chat_jid, sender: Sender, sent_at, text, received_at)`.
- `text_key(text) -> TextKey`: NFKD sem marcas, minúsculas, só letras, dígitos e espaço, colapsado.
  Reusa a normalização de `search/domain/text.py` se a assinatura servir; senão função própria e
  anotação de terceiro uso na STATE.
- `Candidate(id, sender, text_key, text, first_seen_at, group_label, verdict: Verdict)`.
  `Verdict = Pending | Accepted(ride_id) | Rejected(reason) | Failed(error, attempts)`.
  `Candidate.accepts(message) -> bool`: mesmo remetente, mesma chave, `sent_at` dentro de 6h.
- `Judgement = Offer | Request | Update | Other`. `Offer(time: time | None, day: Day, stops:
  tuple[str, ...], seats, price, payment_methods)`, `Day = today | tomorrow | unknown`.
- `checks(text_key, offer, resolved_stops) -> Checks`: `seats_in_text`, `time_in_text`,
  `price_in_text`, `stops_in_text` (fração), `catalog_matches` (contagem). `confidence(checks) -> float`
  com pesos fixos no domínio. Campo ausente conta como conferido (não há o que alucinar).
- `resolve_departure(sent_at, day, time, tz) -> datetime | None`: `time` ausente é `None`;
  `day=today` combina com a data local de `sent_at`; `tomorrow` soma um dia; `unknown` é hoje se
  o horário ainda não passou (com a tolerância), senão amanhã.
- `decide(offer, departure_at, stops, confidence, threshold) -> RideDraft | Rejected`: exige
  `departure_at`, duas paradas, confiança acima do limiar; aplica os padrões de ausência.

## `importing` aplicação (7b)

- Portas: `RideParser.parse(text, sent_at, group_label) -> Judgement`; `StopResolver.resolve(text)
  -> Stop`; `ImportedRides.create(draft) -> RideId`, `find(phone, departure_at) -> RideId | None`,
  `delete(ride_ids)`; `Candidates` e `SourceMessages` (repositórios); `BlockedSenders`; `Purge.run(now)`.
- `ParserOutput` (plano, para o schema): `kind: Literal[offer, request, update, other]`, `time: str |
  None` (`HH:MM`), `day`, `stops: list[str]`, `seats: int | None`, `price: str | None`,
  `payment_methods: list[Literal[cash, pix]]`. `to_judgement(output) -> Judgement` na aplicação.
- `IngestMessage(message)`: numa transação, se a mensagem já tem candidata, nada; senão acha a
  candidata pendente que a aceita ou cria uma, e marca. `JudgeCandidate(candidate_id)`: parse →
  resolução → `decide` → `ImportedRides.find` (junção por partida) ou `create` → veredito. Erro do
  parser vira `Failed` com contagem; a varredura tenta de novo até um teto.
- `PurgeImported(now)`: carona importada com `departure_at + tolerância < now`, sua candidata e suas
  fontes; mensagens sem candidata ou de candidata não aceita julgadas há mais de 24h.

## Adaptadores (7a e 7b)

- App Django `importing` em `adapters/`: `SourceMessageModel` (unique `account, message_id`; FK
  nulável para candidata), `CandidateModel`, `BlockedSenderModel`. Admin somente leitura.
- `DjangoStore(account, watched: Mapping[jid, label])` implementa o `MessageWriter` do extrator:
  `save` é `sync_to_async` de um upsert; filtra antes de gravar.
- `run_extractor`: `Settings(database=WHATSAPP_SESSION_DSN, account=WHATSAPP_ACCOUNT,
  watchlist=Watchlist(chats=jids), view=log)`, `bootstrap.run(settings, wake, writer=store)` e a
  tarefa de varredura em `asyncio.gather`; `wake` é `asyncio.Event.set`. Em 7a a varredura só poda;
  em 7b ingere, julga e poda.
- `OllamaRideParser(base_url, model, timeout)`: `POST /api/chat` com `format=ParserOutput.
  model_json_schema()`, `options.temperature=0`, mensagens do sistema e few-shot em pt-BR (arquivo
  próprio, versionado). `FakeRideParser` responde por tabela.
- Poda: `WorkerPurge` (ORM, na varredura) e `PgCronPurge` (`cron.schedule` idempotente com nome
  fixo, SQL gerado do mesmo `tolerance` e retenção). Contrato: mesmo estado final nos dois, no Postgres.
- Env: `WHATSAPP_ACCOUNT`, `WHATSAPP_SESSION_DSN`, `WHATSAPP_GROUPS`, `IMPORT_PURGE`,
  `IMPORT_RAW_RETENTION_HOURS`, `OLLAMA_BASE_URL`, `RIDE_PARSER_MODEL`, `IMPORT_ACCEPT_THRESHOLD`.

## Front (7b)

- `features/rides`: `RideCard` mostra `Badge` "via WhatsApp" e omite a linha do carro quando
  `car` é nulo; `RideDetail` ganha bloco "Mensagem original" com grupo e data; `ContactButton`
  lida com `plate` nulo. Nenhuma camada nova; tipos do OpenAPI.
