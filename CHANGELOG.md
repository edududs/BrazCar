# Changelog

Formato conforme [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e versões conforme
[SemVer](https://semver.org/lang/pt-BR/). Gerado pelo git-cliff a partir dos commits: não editar à mão.

Antes da 1.0 o contrato ainda se move: `MINOR` traz funcionalidade e pode quebrar contrato,
`PATCH` é correção.

## [0.15.0] - 2026-09-25

### Adicionado

- **rides:** Keep the revealed phone on each contact request
- **rides:** Filter the board from a time of day
- **rides:** Cap the seats of a ride at four

### Corrigido

- **rides:** Stop the from-time hint from matching the day filter in e2e
- **importing:** Clamp the seats of an accepted offer to the ride cap

### Documentação

- Record the v0.14.0 deploy
- **screens:** Capture the from-time board states

## [0.14.0] - 2026-09-25

### Adicionado

- **accounts:** Edit the display name and the email of the account

### Documentação

- Record the v0.13.0 deploy
- Note what comes after the design stage

## [0.13.0] - 2026-09-24

### Adicionado

- Phone number as one composite value object for every context

### Documentação

- Record the v0.12.1 deploy
- Screens of the journeys the phone step touched
- The free-text stop shipped in v0.12.1, not v0.13.0

## [0.12.1] - 2026-09-24

### Corrigido

- **web:** A typed stop is a free-text stop, no checkbox

### Documentação

- Record the v0.12.0 deploy

### Infraestrutura

- **web:** Keep the Playwright run directory out of ESLint

## [0.12.0] - 2026-09-24

### Adicionado

- **demo:** Seed a database with one ride of every situation
- **web:** Delete the account from the account page

### Corrigido

- **web:** Not-found page in Portuguese

### Documentação

- Record the v0.11.0 deploy
- Record the collection step, its runbook and where the screens live
- Renumber the collection step decisions to D-133 and D-134
- Record the two fixes and regenerate the screens catalogue
- Name the release the collection step closes

### Testes

- **web:** Walk every journey with Playwright and keep the screens
- **web:** Name the incomplete reset link after what it shows
- **web:** Keep the catalogue out of a plain suite run

### Infraestrutura

- Move the heavy gate to GitHub and drop the pre-push hook

## [0.11.0] - 2026-09-24

### Adicionado

- **rides:** Free notes on a ride and a fare per stop
- **importing:** Read the price of each stop out of the message
- **web:** Notes and a price per stop in the form, the card and the detail

### Documentação

- Record D-131, price per stop, in the same short step as the notes
- Record the notes and the price per stop step

## [0.10.0] - 2026-09-24

### Adicionado

- **importing:** Manual rejudge of a day, and routes of up to 15 stops that keep both ends

### Documentação

- Record the v0.9.0 deploy and close step 7

## [0.9.0] - 2026-09-24

### Adicionado

- **rides:** Driver and origin as sum types, imported rides on the board and in the contract
- **importing:** Candidates, judgement, acceptance and the Ollama interpreter (7b backend)
- **importing:** Thinking off at the interpreter, pairs split at the resolver, qwen3.5:4b by default

### Corrigido

- **importing:** A seat count outside a car is not said, and the golden runner survives a bad answer

### Documentação

- Descrever como o projeto é conduzido em docs/method.md
- Reescrever o README como vitrine para leitor externo
- Alinhar arquitetura e STATE com o que existe hoje
- Registrar D-108, repositório público e de portfólio
- Tirar a marca da ferramenta e os vícios de texto do README e do method
- Adotar a licença MIT
- Registrar D-109, política de testes do projeto
- Tirar os travessões de ritmo da linha D-108
- Alinhar a entrega com a main depois do rebase
- Record the v0.8.0 deploy
- Close step 7b in STATE, ROADMAP and the parser measurements

### Testes

- **importing:** Make the worker interval test wait on an event instead of the clock
- **importing:** The golden set of 120 real messages, and the docs of 7b

### Infraestrutura

- Medir cobertura no portão do GitHub, sem serviço de terceiros
- Medir a cobertura do front sobre o src inteiro

## [0.8.0] - 2026-09-23

### Adicionado

- **importing:** Embed the extractor behind a DjangoStore over a source message table
- **importing:** Worker loop, environment settings and the pairing and group commands
- **importing:** Purge by pg_cron or by the worker, the pg_cron Postgres image and the worker service

### Documentação

- Record the v0.7.0 deploy
- Design step 7, the embedded extractor and the importing context
- Close step 7a in STATE, ROADMAP, architecture and the deploy runbook

### Infraestrutura

- **api:** Git in the build stage and libmagic in the runtime image for the extractor
- Ignore the worktrees the agent tooling creates under .claude

## [0.7.0] - 2026-09-23

### Adicionado

- **api:** Serve the oldest front version still accepted (D-105)
- **web:** Installable online-only PWA with update prompt, version floor and offline screen
- **web:** Reach the SSE diagnostics from the footer version and type the token there

### Corrigido

- **web:** Count a wake-up burst as one board refresh and refetch on every focus
- **web:** Shorten the board's silence watchdog to 35s and keep the diagnostics page off the footer

### Documentação

- Record the v0.6.0 deploy and the search index rebuilt by the entrypoint
- Close step 5 with v0.6.0 in STATE and ROADMAP
- Record that visual design is its own stage after the MVP pieces exist (D-103)
- Close step 6 in STATE, ROADMAP, architecture and the deploy runbook

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
