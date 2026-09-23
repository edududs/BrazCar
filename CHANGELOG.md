# Changelog

Formato conforme [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e versões conforme
[SemVer](https://semver.org/lang/pt-BR/). Gerado pelo git-cliff a partir dos commits: não editar à mão.

Antes da 1.0 o contrato ainda se move: `MINOR` traz funcionalidade e pode quebrar contrato,
`PATCH` é correção.

## [0.6.0] - 2026-09-23

### Adicionado

- **search:** Add a text search context that stands on its own
- **rides:** Filter the board by the text of any stop, catalog or other
- **web:** Name the route by origin and destination, search the board by text and put a nav bar on every page

### Documentação

- Record the v0.5.0 deploy and the board signal seen through the tunnel
- Name v0.6.0 in STATE for the adjustments after the phone test

## [0.5.0] - 2026-09-22

### Adicionado

- **rides:** Model the ride offer with computed status, edit rules and domain events
- **rides:** Add the ports, use cases and board read model
- **shared:** Add the board revision row, the polling board signal and a rate limiter behind ports
- **rides:** Persist rides with their history and serve the board, the driver actions, the contact and the signal
- **accounts:** Limit login and password-reset attempts per phone
- **web:** Add the board with filters in the URL, the ride pages and the contact button

### Corrigido

- **rides:** Validate catalog stops, type the car id and put the contact limit behind the shared port
- **web:** Show an external place in the picker, keep seats out of the edit form and unnest the edit route

### Documentação

- Record the v0.4.0 deploy and the image tag without the v
- Close the rides step, record its decisions and bring STATE, ROADMAP and the glossary up to v0.5.0

## [0.4.0] - 2026-09-22

### Adicionado

- **accounts:** Model the account with phone and plate value objects and its cars
- **accounts:** Add the ports and use cases for signup, login, cars, recovery and deletion
- **accounts:** Persist accounts on a custom Django user, proven on SQLite and Postgres
- **accounts:** Expose signup, session, cars and password recovery over HTTP
- **accounts:** Add the session hook, gateway and the signup, login and account screens
- **accounts:** Add the forgot-password and reset-password pages the e-mail link opens

### Corrigido

- **release:** Point the Postgres contract at the same .env the compose reads

### Documentação

- Bring STATE, ROADMAP and architecture up to v0.4.0 before the release

## [0.3.0] - 2026-09-22

### Adicionado

- **shared:** Add a frozen model base whose copies are validated
- **places:** Model the catalog as the aggregate, with search and hierarchy rules
- **places:** Persist the catalog behind a port proven on SQLite and Postgres
- **places:** Expose the catalog through public read-only routes
- **places:** Add the front gateway and a headless place search hook
- **places:** Keep the catalog in a versioned file synced by an idempotent command
- **places:** Add a place picker on a Base UI combobox primitive

### Documentação

- Bring STATE, ROADMAP and architecture up to v0.3.0 before the release

## [0.2.1] - 2026-09-21

### Corrigido

- Run the heavy gate through named tasks the closing ritual can call
- **release:** Keep one version across the package, the API and the contract

### Documentação

- Bring STATE up to v0.2.1 before the release

## [0.2.0] - 2026-09-21

### Adicionado

- **shared:** Add a token-gated diagnostic SSE route and CORS by environment
- **shared:** Let the diagnostic heartbeat be an event the browser can see
- **web:** Add a resilient EventSource adapter and the SSE diagnostics page

### Corrigido

- **build:** Let the container healthcheck pass with production ALLOWED_HOSTS
- **web:** Reconnect at once when a resumed stream proves dead, and count browser retries as new streams

### Documentação

- Plan the SSE tunnel risk test and record the local baseline
- Record the tunnel measurements and the first deploy runbook
- Update STATE with the published endpoints and what is left
- Rewrite the iPhone script so it explains what each step is for
- Record the SSE verdict (D-076 to D-079) and close step 2
- Carry the SSE verdict into the architecture, the rules and the map
- Add the step closing runbook and record D-080 and D-081
- Bring STATE and the roadmap up to v0.2.0 before the release

### Infraestrutura

- Point the editor at backend/ruff.toml from the repo root
- Add the API image, the deploy compose, GHCR publishing and an SSE load script
- **web:** Serve the SPA shell for every route on Vercel
- Add release tooling with git-cliff, a local release script and a release workflow

## [0.1.0] - 2026-09-20

### Adicionado

- **backend:** Scaffold Django 6 ASGI skeleton with tooling and architecture guard
- **web:** Scaffold React 19 front with strict tooling and generated API types

### Corrigido

- **backend:** Type the logging settings so pyright strict passes
- Let pre-push handle a remote commit missing from the local clone

### Documentação

- Add product, architecture, decision log and domain glossaries
- Record the first publication and green CI in STATE
- Close step 1 in the roadmap and STATE

### Testes

- Check documentation links in the fast gate

### Infraestrutura

- Add git hooks, CI fast gate, env examples and dev compose
- Allow running the fast gates manually
