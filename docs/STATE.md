# Estado do projeto

Atualizado em 2026-09-25.

## Onde estamos

Versão `v0.21.0`: passo 6 da etapa de design, o canal de opinião (D-155): contexto `feedback`, só
para quem tem conta, entrada só na Conta, três tipos, e a reclamação que aponta alguém pelo celular,
lida só pelo comando `manage.py feedback`, com o número mascarado. Antes: `v0.20.0`, passo 5,
movimento (D-153), e a bateria de testes de uso dos componentes (D-154) com a correção de dois defeitos achados pelo Eduardo no celular: a hora não
aceitava digitação, e o fim do formulário de publicar ficava atrás do botão fixo. Antes: `v0.19.0`,
passo 4, formulários, conta e acesso (D-151, D-152): componente
de data e hora da F7, trajeto desenhado com preço por parada atrás de interruptor, conta em leitura
com edição em folhas, entrar, criar conta e recuperar senha. Antes: `v0.18.0`, passo 3, mural e
detalhe (D-150): hora-herói, linha da rota, seções por dia com "Agora", chips com folha de horário
e preço, céu do horário no detalhe, contato revelado no cartão do motorista, painel do dono;
`v0.17.0`, passo 2, a casca
(D-148, D-149): abas embaixo, marca e ícones do app, cabeçalho que encolhe, avisos flutuantes e
vazios com a rota tracejada; `v0.16.0`, passo 1, a fundação (D-143 a D-147): tokens em dois temas, tema com escolha manual,
fonte de destaque hospedada e a pele nova dos primitivos; `v0.15.0` (contato rastreável, filtro "a partir
de", vagas até 4), `v0.14.0` (editar conta e senha), `v0.13.0` (telefone como value object),
`v0.12.0`, passo de coleta: semente de demonstração, suíte de ponta a
ponta com o Playwright e [catálogo de telas](screens/README.md), para a etapa de design (D-103)
ter o que olhar; e o portão pesado passou para o GitHub (D-132). Antes: `v0.11.0`, passo curto
de observações e preço por parada. Antes disso:
`v0.10.0` (reprocessamento manual e rota de até 15 paradas), `v0.9.0` (passo 7b, importação no
mural), extrator embutido (`v0.8.0`), tempo real e PWA (`v0.7.0`), esqueleto (`v0.1.0`),
SSE confirmado pelo túnel e num iPhone (`v0.2.0`, D-076), ritual de encerramento corrigido
(`v0.2.1`), `places` (`v0.3.0`), `accounts` (`v0.4.0`), `rides` (`v0.5.0`) e os ajustes do teste
no celular (`v0.6.0`). API publicada em `api-brazcar.elj-labs.org` e front em
`brazcar.elj-labs.org` ([runbooks/deploy.md](runbooks/deploy.md)), os dois na `v0.7.0` desde
2026-09-23; a API e o worker na `v0.9.0` desde 2026-09-24; API, worker e front na `v0.11.0` desde
2026-09-24; API, worker e front na `v0.21.0` desde 2026-09-25.

- `backend/`: uv, Python 3.14, Django 6 ASGI com django-ninja, `config/` como raiz de
  composição, logs JSON, banco por `DATABASE_URL`, ruff `ALL`, pyright strict, teste de
  arquitetura por AST. Em `shared/domain`, `FrozenModel`. Em `shared/application`, as portas
  `Clock`, `Mailer`, `RateLimiter` (D-097), `BoardRevision` e `BoardSignal` (D-098). Em
  `shared/adapters`: app Django `shared` com a linha da revisão e a tabela de hits, o sinal por
  leitura 1x/s, SSE, rota de diagnóstico, CORS, `OriginCheckMiddleware` (D-091), `session_auth`
  e `optional_account_id`, relógio, e-mail e `GET /api/web-version`, o piso de versão do front
  lido de `WEB_MINIMUM_VERSION` (D-105).
- `places` (v0.3.0): `Catalog` é o agregado (D-083), `Place` com `PlaceId` em slug (D-084);
  rotas públicas `GET /api/places?q=` e `/api/places/{id}` (D-086); catálogo em `catalog.toml`
  sincronizado por `manage.py sync_places` no entrypoint (D-087).
- `accounts` (v0.4.0, limites na v0.5.0): `Account` com carros; `AccountId` é o UUID do usuário
  do Django (D-090); rotas em `/api/accounts`; sessão por cookie `brazcar_session`. Login estourado
  responde 429 e recuperação de senha estourada cai em silêncio (D-097).
- `accounts` (passo curto, ainda sem tag, D-139): a própria conta edita nome social e e-mail por
  `Account.update_profile` e o caso de uso `UpdateProfile`, atrás de `PATCH /api/accounts/me`
  (`ProfileIn`, campos opcionais: ausente não muda, e-mail em branco limpa); e troca a senha
  estando logada por `ChangePassword`, atrás de `POST /api/accounts/me/password`, com a senha
  atual conferida pela porta `Credentials` e o mesmo balde de tentativas do login (`login:<telefone>`,
  D-097), para uma sessão roubada não virar oráculo de força bruta. Telefone continua fora de
  alcance até a verificação de posse (D-027). No front, "Seus dados" e "Senha" viraram formulários
  na página da conta, com o telefone só mostrado; aviso "Sem e-mail você não recupera a senha"
  perto do campo quando ele está vazio.
- `rides` (v0.5.0): `RideOffer` com situação calculada (ADR-0003), regras de edição e atraso
  (ADR-0004), eventos gravados em tabela só de acréscimo na mesma transação (ADR-0005, ADR-0008),
  revisão do mural incrementada junto (ADR-0010). Paradas do catálogo conferidas (D-093), datas
  de volta no fuso do mural (D-094). Rotas em `/api/rides`: mural público com filtros por lugar
  (com descendentes), dia, vagas e preço; `GET /mine`, `GET /{id}`; publicar, editar, vagas,
  cancelar, repetir (só o dono); contato (ADR-0006, D-095); `GET /revision` e `GET /signal` (SSE).
  Read model `RideOut` sem telefone nem placa, com situação e ações prontas (D-096).
- `rides` (v0.11.0): `RideOffer.notes` é texto livre opcional de até 500 caracteres, em publicar,
  editar e repetir, recusado (422) quando parece telefone, e-mail ou placa, pelo detector de
  `shared/domain/personal_data.py` (D-129); `Stop.fare` é o preço de chegar até aquela parada, e
  com alguma tarifa o `price` da carona é a menor delas, calculado por `price_from` (D-131). O
  read model leva `notes`, a tarifa de cada parada e `has_fares`, para a tela só desenhar. Migração
  `rides.0003`, aditiva. A busca "passa por" continua lendo só as paradas.
- `rides` (passo curto, ainda sem tag, D-140 a D-142): `ContactRequest` guarda também o número
  revelado, o tipo de motorista (`registered`/`external`) e a conta dele quando tem uma; sobrevive
  à carona (`ForgetRides` não apaga mais o registro, só a FK vira nula), consultável por
  `manage.py contact_requests --account`/`--phone`, mascarado por padrão. Migração `rides.0005`,
  aditiva, preenche os registros existentes a partir da carona quando ela ainda existe. `BoardFilter`
  ganha `from_time`: hora local da partida a partir de um horário (`?from=HH:MM`), sem dia vale para
  cada dia da lista, com dia só naquele dia; comparado no banco por `ExtractHour`/`ExtractMinute` no
  fuso do mural, nos dois bancos. `Seats` do domínio passa a `MAX_SEATS` (4, o que cabe num carro de
  passeio); publicar, mudar vagas e repetir recusam acima disso com 422.
- `rides` (v0.9.0): `RideOffer.driver` é tipo-soma `RegisteredDriver` (conta e carro, carro
  opcional só na importada) ou `ExternalDriver` (telefone e nome do WhatsApp); `origin` é `Published`
  ou `WhatsApp` com o texto original redigido (ADR-0015, D-127, D-128). `ImportRide` (conta pelo
  telefone ou externo; junção por partida) e `ForgetRides`; contato sem placa para externo; `RideOut`
  com `car` opcional, `origin` e `origin_message`; tolerância 10 min (D-121).
- `importing` (v0.9.0; desenho em D-108 a D-129, ADR-0015 e ADR-0016; glossário em
  [domain/importing.md](domain/importing.md)): mensagem-fonte, candidata com veredito, julgamento
  (`Offer`, `Request`, `Update`, `Other`), conferências e confiança, `resolve_departure`, `decide`;
  casos de uso `IngestMessages`, `JudgeCandidates`, `PurgeImported`, `BlockSender`; adaptadores
  Django, `OllamaRideParser` (JSON schema de `ParserOutput`, pensamento desligado, `httpx` só ali),
  `CatalogStopResolver`, `RidesBridge`; poda em SQL para o `pg_cron` provada igual ao caso de uso por
  contrato; comandos `import_rides`, `candidates`, `block_sender`. Golden set de 120 mensagens reais
  anonimizadas e as medições por modelo em [parser-models.md](parser-models.md): `qwen3.5:4b` é o
  padrão. Catálogo com os bairros de Brazlândia e pontos de Brasília (D-122). Detector de dados
  pessoais em `shared/domain/personal_data.py`.
- `importing` (v0.11.0): o interpretador devolve pares parada e valor (`StopFare`, `OfferFare`) e
  `attach_fares` decide, em código, a qual parada cada par pertence; par que não nomeia uma parada
  só, que cai na parada de saída ou cujo valor não está na mensagem é descartado (D-131). A
  candidata aceita carrega as tarifas e o rascunho custa a menor delas. Os pesos da confiança não
  mudaram e a importação continua sem preencher `notes` (D-129).
- `web/` (v0.9.0): card com selo "via WhatsApp" e carro opcional, detalhe com a mensagem original,
  contato sem placa; primeiros testes de componente (`ride-card`, `ride-detail`, `contact-button`)
  sobre um harness com roteador em `shared/testing/`.
- `web/` (v0.11.0): formulário com caixa de observações e contador de 500, e campo de preço em cada
  parada menos a primeira; com alguma tarifa o campo de preço da carona some, porque quem decide é
  a API. Card com as observações numa linha cortada e "a partir de" quando a API marca `has_fares`;
  detalhe com as observações inteiras e a tarifa ao lado de cada parada. Primitivo novo
  `TextAreaField` em `shared/ui`. Testes de componente de `ride-form`, e de `ride-changes` e
  `useRouteDraft` no headless (D-126).
- Contratos de porta em `backend/tests/contracts/` (D-085): `CatalogRepository`,
  `AccountRepository`, `RideRepository` e `RateLimiter`, cada um no fake, em SQLite e no Postgres
  do compose (`poe test-postgres`).
- `web/`: yarn 4, Vite, React 19, TypeScript strict, Tailwind v4, TanStack Router e Query, Base UI
  (D-088). `features/rides` em quatro camadas: gateway e fonte do sinal (sobre
  `resilient-event-source`) em `adapters`; hooks `useBoard`, `useBoardSignal`, `useRide`,
  `useMyRides`, `usePublishRide`, `useContact`, `useRouteDraft` e `useForgetBoardOffline` em `app`
  (todos com teste, menos `useRide` e `useMyRides`); cards, filtros,
  formulário, detalhe e botão de contato em `ui`. Rotas `/` (mural, filtros na URL),
  `/caronas/$rideId`, `/caronas/$rideId/editar`, `/publicar`, `/minhas-caronas`. Primitivos novos
  em `shared/ui`: `Badge`, `Card`, `SelectField`, `ConfirmDialog`; `PageShell` ganhou `actions`.
- PWA (v0.7.0, D-106): `vite-plugin-pwa` em modo `prompt`, manifesto e ícones provisórios, precache
  só da casca. Em `shared`: adaptadores de service worker, rede, modo de exibição, versão do build e
  piso; hooks `useAppUpdate`, `useVersionFloor`, `useNetworkStatus`, `useInstallHint` e
  `useUnsavedWork` (o formulário de carona se marca); primitivos `NoticeScreen`, `NoticeBar`,
  `AppFooter`. A raiz mostra "Sem internet" por cima da página montada, a tela de atualização
  obrigatória abaixo do piso, o aviso de build novo e a dica de "Adicionar à Tela de Início" no
  iPhone. A versão do build fica no rodapé; o `scripts/release.sh` acompanha o `web/package.json`.
- Tempo real (D-104, D-107): rajada ao acordar vale uma busca, qualquer que seja o sorteio; busca
  ao focar e ao voltar a rede é explícita; ao reconectar o primeiro quadro do stream é a comparação
  de revisão; vigia de silêncio do mural em 35s.
- `demo` (D-133): pacote `backend/src/brazcar/demo/`, só com `adapters/`, e o comando
  `manage.py seed_demo`. Sete contas (motorista com um carro, com dois, sem carro, só passageiro,
  nome social longo, conta nova, e a dona de uma carona importada), quinze caronas cobrindo toda
  situação calculada em três dias, com e sem tarifas, com e sem observações (uma no limite de 500),
  paradas do catálogo e texto livre, até quinze paradas, repetida e com histórico de edição; três
  importadas (externa, com tarifas, e a vinculada a conta); doze mensagens-fonte em dois grupos,
  onze candidatas com um veredito de cada tipo, um remetente bloqueado; e pedidos de contato,
  inclusive uma conta com a cota do dia inteira gasta. Determinístico dado o momento em que roda,
  recusa-se fora de `DEBUG`, apaga o que criou antes de recriar, e grava um manifesto.
- Ponta a ponta (D-134): `web/e2e/` com o Playwright em dois projetos, celular e desktop, 95 testes
  cobrindo visitante, cadastro e conta, motorista, passageiro, importadas e tempo real. Cada estado
  relevante é fotografado pelo helper `snap`; 131 imagens em `docs/screens/` (5,1 MB) e o
  `docs/screens/README.md` gerado por `scripts/screens-catalog.mjs`. Tasks `yarn e2e` e
  `yarn screens`; workflow `e2e.yml` no GitHub. Runbook em [runbooks/screens.md](runbooks/screens.md).
- Dois defeitos achados ao fotografar as telas no passo de coleta, corrigidos antes da etapa de
  design: a tela de conta ganhou o botão "Excluir conta", separado das ações comuns, atrás de um
  `ConfirmDialog` que explica a consequência e chama a mutação `deleteAccount` que já existia em
  `useSession` (D-033); e a rota raiz ganhou `notFoundComponent` em português, com o primitivo
  `shared/ui/route-not-found.tsx` sobre o `NoticeScreen` e um link de volta ao mural, no lugar do
  "Not Found" em inglês do roteador (D-007).
- Parada em rota deixa de alternar entre catálogo e texto livre pela caixa "Outro lugar": o
  `PlacePicker` vira o campo único que D-123 pedia, com o que foi digitado e não escolhido na
  lista valendo como a própria parada, em `web/src/features/places/ui/place-picker.tsx`.
- Telefone (D-135 a D-138): value object `PhoneNumber` em `shared/domain/phone/`, feito de
  `CountryCode`, `AreaCode` e `SubscriberNumber`, com `parse`, `from_jid_user`, `e164`, `jid_user`,
  `display`, `international`, `region` e `is_mobile`, sobre a `phonenumbers` confinada em `codec.py`.
  `accounts` aplica a regra de celular do Brasil (`account_phone`) e recusa fixo, número de fora e
  número inválido com 422 e mensagem em português; antes, telefone malformado no cadastro
  respondia 500. `rides` e `importing` aceitam qualquer número válido. O `from_jid_user` devolve o
  nono dígito a endereço antigo do WhatsApp, o que conserta o vínculo de D-127 para esses
  remetentes; as migrações `importing.0003` e `rides.0004` corrigem o que já estava gravado. A API
  entrega `phone_display` na conta e no contato. No front, `usePhoneInput` em `shared/app` formata
  enquanto a pessoa digita e valida antes de enviar, o primitivo `PhoneField` é usado no cadastro,
  no login e na recuperação de senha, e o card de contato mostra o número; a `libphonenumber-js`
  (`min`) fica confinada em `shared/app/phone-codec.ts` por regra do ESLint.
- Design, passo 6, canal de opinião (D-155): contexto `feedback` no backend (`Feedback`,
  `FeedbackKind`, a porta `FeedbackBox`, `SendFeedback` com o `RateLimiter` por conta,
  `ReadFeedback`), app Django com migração, rota `POST /api/feedback` com sessão, e o comando
  `manage.py feedback --since/--reveal`, que mascara o celular apontado e avisa quando o texto traz
  dado pessoal. `PhoneNumber.masked()` e `signed_in_account_id` passaram a `shared` (o comando de
  contatos e as rotas de contas e caronas usam os mesmos), e a frase de celular inválido também
  (`shared/adapters/phone_input.py`). A semente esquece as opiniões das contas de demonstração antes
  de apagá-las. No front, `features/feedback` com `useFeedbackDraft` (headless, com teste) e
  `FeedbackSheet`: tipo num segmentado, opinião com contador, e na reclamação a caixa "É sobre alguém
  específico" que abre o campo do celular; a linha "Enviar opinião" no grupo BrazCar da Conta.
- Design, passo 5, movimento e usabilidade (D-153, D-154): tokens de movimento com as entradas
  nomeadas (`animate-rise-in`, `-list-in`, `-ride-in`, `-bump`, `-reveal`), só `transform` e
  `opacity`, zeradas com "reduzir movimento" por `--motion-rise`/`--motion-scale`; View Transitions
  do roteador com a hora do card e a do detalhe sob o mesmo nome; parallax do céu, hora que encolhe e
  barra compacta no detalhe por rolagem em CSS, dentro de `@supports`; lista do mural cruzando em
  opacidade ao trocar filtro; carona "Nova" entrando; número do passo de vagas deslizando; contato
  revelado descendo; toast subindo. `shared/domain/flash.ts` + `useFlash` + `FlashToast`: aviso
  carregado no estado da navegação ao publicar, editar, repetir e sair da conta (sair agora volta
  ao mural). `motion.test.ts` lê o catálogo. Correções: `useNumberSegment` (headless, com teste)
  faz a hora e os minutos aceitarem digitação — foco esvazia o campo com o valor como dica, cada
  dígito válido já vale, dois dígitos pulam para os minutos, valor fora de faixa é marcado e
  desfeito ao sair; `ActionBar` passou a `sticky` no fim do conteúdo (com `bleed` dentro de
  `PageShell`), e o detalhe perdeu o espaço compensado à mão; a busca devolve o foco ao campo depois
  de limpar. Bateria de uso com `user-event`: relógio, data e hora, campos de texto, senha, celular,
  busca, observações, seleção, caixa de marcar, passo, interruptor, alternância, chip, segmentado,
  folha, diálogo de confirmação, filtros do mural, parada (catálogo, teclado, texto livre),
  formulário de carona e conta. Na ponta a ponta, a saída é digitada tecla a tecla e
  `e2e/layout.spec.ts` mede que o fim do formulário e o último cartão do detalhe ficam acima da
  barra.
- Design, passo 4, formulários, conta e acesso (D-151, D-152): `DateTimeField` (dia · hora, folha
  com cartões de dia, calendário, `ClockPicker` com hora e minutos digitáveis, horários comuns,
  frase de resumo, "Pronto"; dia travado na edição), sobre `calendar.ts` e `useDateTimeDraft` em
  `shared/app`, com teste; o `TimeSheet` do mural passou a usar o mesmo `ClockPicker`. `RideForm`
  reescrito: carro com ícone, trajeto como linha (`StopRow` com bolinha, `PlacePicker`, "Parada no
  caminho" tracejado, remover), interruptor "Preço diferente por parada" (`SwitchField`, Base UI
  Switch) que mostra o campo de tarifa por parada e o aviso do "a partir de" com a menor delas
  (`useRouteDraft.cheapestFare`), vagas em `Stepper`, pagamento em `ToggleField`, observações
  opcionais, botão fixo em `ActionBar` submetendo o formulário pelo atributo `form`. Publicar abre
  por cima (X, sem abas) e sem carro mostra a tela com o glifo do carro; editar com seta de voltar
  e a regra do dia num aviso antes do erro. Conta em leitura: perfil com avatar, grupos "Seus
  dados" (Editar dados e Trocar senha em `Sheet`), "Carros" (linhas com placa, remover, cadastro em
  folha), "Aparência" e "BrazCar" (sair, excluir com o celular no diálogo); toasts "Dados salvos.",
  "Senha alterada.", "Carro cadastrado."; sem sessão, o cartão "Entre para publicar e pedir
  contato". Entrar (voltar, marca, "Celular", `PasswordField` com mostrar, "Esqueci a senha" ao
  lado do rótulo), criar conta (nome social, celular com WhatsApp, e-mail opcional, senha), esqueci
  a senha (glifo da chave; enviado vira "Confira seu e-mail") e link incompleto. Abas só no mural,
  em minhas caronas e na conta. `PageShell` ganhou `compact`, `back`, `lead` e `intro`;
  `FieldFrame` ganhou `optional` e `labelAside`; `SelectField` ganhou `prefix`; `IconButton`,
  `IconLink`, `SwitchField`, `ToggleField`, `PasswordField`, `ClockPicker`. A suíte de ponta a
  ponta escolhe a saída pela folha (`e2e/support/departure.ts`) e a prevenção do outro dia na
  edição substituiu a recusa do servidor como cenário.
- Design, passo 3, mural e detalhe (D-150): `RideCard` com a hora em Bricolage, `RouteLine` (rota
  numa linha, paradas marcadas em Anil quando casam com a busca), preço curto ("R$ 7"), `SeatPips`
  (barrinhas, teto 4), avatar de iniciais, selos só para exceção, "Nova" com anel quando a carona
  chega pelo sinal; `RideList` em seções por dia com o marcador "Agora" (ou "Próximas"/"Encerradas"
  em minhas caronas); `BoardFiltersForm` como `SearchField` + chips (`Chip`, `ChipRow`), com
  `TimeSheet` (horários rápidos, "Agora", hora e minutos em passos de 15) e `PriceSheet` sobre o
  primitivo `Sheet` (Base UI Drawer); a linha "Mostrando caronas que passam por … (SCS)" quando um
  apelido do catálogo fez a busca. `RideDetail` reescrito: céu do horário (`skyOf`), botão de voltar
  em vidro, hora a 80 px (riscada se cancelada, cinza se já saiu), `RouteList` vertical com tarifas,
  fatos (vagas, preço, paga com), observações, cartão do motorista com o contato revelado nele
  (`Plate`), mensagem original em balão, `ActionBar` fixa com a ação certa por situação e sessão,
  painel do dono com `Stepper` de vagas, `ListGroup`/`ListRow` (Editar, Repetir em folha, Cancelar)
  e as frases de consequência. A página da carona não tem abas nem título visível. Headless novo,
  com teste: `sky.ts`, `use-fresh-rides.ts`, `board-days.ts`, `use-board-match.ts`,
  `shared/app/use-time-draft.ts`, `shared/app/use-clock.ts`. Primitivos novos: `Sheet`, `Chip`,
  `SearchField`, `Stepper`, `Avatar`, `ActionBar`, `ListGroup`/`ListRowButton`/`ListRowLink`,
  `SectionHeading`. `contact-button` saiu: o pedido de contato vive no detalhe.
- Design, passo 2, casca (D-148, D-149): a raiz deixa de ter barra no topo e rodapé e ganha a
  `TabBar` embaixo (Caronas, Publicar em Anil, Minhas, Conta ou Entrar), com vidro e área segura;
  o mural abre com a marca (`Wordmark`) no lugar do título, que fica só para leitor de tela, e a
  `TopBar` encolhe por `animation-timeline: scroll()` com a barra compacta aparecendo entre 70 e
  130 px, tudo em CSS e parado onde não há suporte ou com "reduzir movimento". Avisos flutuam:
  `Toast` (versão nova, com "Atualizar"; sem internet como alerta no topo, com a página esmaecida e
  `inert`), `InstallHintCard` (a dica do iPhone com os ícones de Compartilhar e Adicionar à Tela de
  Início). `EmptyState` com a rota tracejada na lista vazia e na página inexistente; a tela de piso
  de versão com o símbolo grande. `BrandMark` em SVG e os ícones do app gerados por
  `scripts/app-icons.mjs`. A versão do build foi para a tela de conta. Saíram `AppNav`,
  `AppFooter` e `AppShellNotices`. Os testes de ponta a ponta da casca passaram a ler o alerta e o
  cartão pelos papéis (`alert`, `complementary`), não pelo texto antigo.
- Design, passo 1, fundação (D-143 a D-147): a identidade "Hora azul" do canvas entra pela base.
  `styles.css` com os tokens por papel em dois temas (22 cores, sombras, raios, tipo, movimento) e
  o `@theme inline` só nomeando; a paleta padrão do Tailwind desligada e um teste que recusa token
  antigo, cor de paleta e `opacity-*` em componente. Tema pelo sistema com escolha manual na conta
  (`ThemeControl` sobre o primitivo `Segmented`), aplicada antes da primeira pintura por script
  inline; `shared/domain/theme.ts`, `shared/adapters/theme.ts` e `useTheme`, com teste. Bricolage
  Grotesque 700 hospedada em `web/public/fonts/` (28 KiB, latino do pt-BR, gerada por
  `scripts/subset-display-font.py`), com teto de 30 KiB testado. Pele nova dos primitivos com a API
  de sempre e as props da prancha F4: `ActionButton` (`ink`, `outline`, `ghost`, `critical-solid`,
  `compact`, `busy`, `icon`), `Badge` (`inverse`, `outline`, `sun`, `icon`), `Card` (`highlight`,
  `padding`), `NoticeBar` (`tone`, `role`), `ConfirmDialog` (`icon`, botões empilhados), campos
  sobre as peças internas `FieldFrame` e `Box` (prefixo, sufixo, só leitura), `Icon` com os SVGs do
  canvas, `Segmented`, `inlineLinkClass`. Views só trocaram classe (token antigo → novo, opacidade →
  `ink-2`/`ink-3`), sem redesenho: casca, mural, detalhe e formulários são dos passos 2 a 4. A
  suíte de ponta a ponta ganhou o projeto `mobile-dark`; o catálogo fotografa só o claro por padrão.
  Barra de status do iPhone em `black-translucent`.
- Cobertura: medida só nos fluxos do GitHub, depois do portão rápido. Backend com `pytest-cov`
  (`poe coverage`), 88,58% medidos sobre `src/brazcar` e piso de 87%; front com `@vitest/coverage-v8`
  (`yarn coverage`), 96,51% medidos sobre `src` e piso de 94% (linhas: 97% e piso de 95%), acima da
  meta de paridade (D-126): adaptadores pelo contrato, hooks, componentes com `user-event` e as rotas
  montadas sobre o app inteiro (`shared/testing/render-app.tsx`). O resumo
  fica no log do passo e nada é enviado para serviço de terceiros (D-008).
- Portões (D-132): o `pre-push` saiu, nenhum hook roda teste no push. O GitHub roda o portão
  pesado (Postgres como serviço do runner, build do front); localmente ele é ato explícito do
  ritual de encerramento. Um hook `commit-msg` recusa assunto fora do Conventional Commits e
  trailer ou menção a ferramenta de IA.

**Verificado de verdade no passo 7b:** portão rápido (343 testes no backend, 63 no front, com os
primeiros de componente) e portão pesado dos dois lados, com 31 contratos no Postgres do compose,
entre eles o que prova que a poda em SQL do `pg_cron` e o caso de uso apagam as mesmas linhas.
Golden set medido no notebook (RTX 4050): `qwen3.5:4b` tipo 95%, campos 92%, mediana 1,3 s;
`qwen2.5:7b-instruct` 91%, 93%, 3,1 s; `qwen2.5:3b-instruct` reprovado no dia. Na máquina de teste,
pelo túnel: `qwen3.5:4b` 94%, 91%, mediana 4,3 s; `gemma3:4b` 92%, 83%, 4,0 s (tabela completa em
[parser-models.md](parser-models.md)); o container do worker alcança o Ollama por `host.docker.internal`.

Publicado e conferido em 2026-09-24: imagens `0.9.0` no GHCR e na máquina, migrações `importing.0002`
e `rides.0002` aplicadas, 43 lugares no catálogo, job de poda reinstalado com a regra inteira, worker
autenticado e julgando com o `qwen3.5:4b` da máquina. A primeira varredura tomou 7 mensagens em 4
candidatas (uma repostada em 3 grupos, outra em 2) e criou 3 caronas; a quarta foi rejeitada como
não oferta. As 3 aparecem no mural público pela API, sem carro, sem ação de dono e sem telefone no
payload.

**Verificado de verdade no passo das observações e do preço por parada:** portão rápido (373 testes
no backend, 75 no front) e portão pesado dos dois lados, com os 31 contratos no Postgres do compose.
Cobertura do backend em 88,58%, acima do piso de 87%. Pelas rotas, com o banco de verdade:
observações escritas, reescritas, apagadas e fora da busca "passa por"; telefone, e-mail e placa
recusados com 422 e a frase do botão de contato; tarifa por parada precificando a carona pela menor
delas, ignorando o preço digitado, entrando no filtro de preço máximo e sobrevivendo ao repetir;
tarifa na primeira parada recusada. No front, por teste de componente: o contador de 500, o campo de
preço sumindo quando uma parada tem tarifa, o "a partir de" no card e as tarifas ao lado das paradas
no detalhe.

**Verificado de verdade no passo de coleta:** portão rápido e portão pesado dos dois lados, e a
suíte de ponta a ponta verde nos dois projetos (95 casos, 1 pulado: a dica de instalação só existe
no celular). A semente roda duas vezes sem duplicar, recusa fora de `DEBUG` e, com `--forget`, não
deixa linha nenhuma — coberto por teste. Pelo navegador, de verdade e com o banco de verdade:
mural com e sem filtro, filtro de dia e de vaga na URL, "passa por" achando pelo apelido ("SCS") e
pelo lugar acima ("Plano Piloto"); cadastro recusando senha curta e entrando no mural; login com
senha errada; recuperação de senha até a tela do e-mail; carros cadastrados e removidos; publicar
simples, com muitas paradas e tarifas, com parada em texto livre, e a observação com telefone
recusada com a frase do botão; editar dentro do mesmo dia e a recusa de outro dia; vagas fechando e
reabrindo; cancelar com diálogo; repetir; pedir contato com a placa, sem placa na importada, e a
recusa com a cota do dia gasta; a mensagem original redigida; o mural aprendendo, sem recarregar, a
carona que outro contexto acabou de publicar (SSE); excluir a conta pelo diálogo de confirmação, o
telefone dela deixando de servir para entrar, e a página em português para todo endereço que não é
rota nenhuma.

**O workflow `e2e` da `v0.20.0` falhou no GitHub (11 falhas) e passava aqui:** teste frágil, não
defeito de produto. O teste de editar publicava a carona em âncora + 13 h e afirmava o cartão
"Amanhã" apagado; a rodada começou às 11:07 em Brasília, a carona caiu no dia seguinte, e o cartão
dela, corretamente, estava aceso. Reproduzido aqui depois das 11h e corrigido: o teste lê o dia da
própria carona. As outras falhas eram cascata do limite de login: o teste de senha errada gastava as
tentativas da conta de motorista da semente e cada nova tentativa do GitHub, num processo novo,
logava tudo de novo. Agora esse teste cria a própria conta (a semente reserva quinze telefones) e
as sessões ficam num arquivo da rodada. Verificado com a suíte inteira às 12:50 em Brasília, com uma
nova tentativa por teste como no GitHub: 161 verdes.

**Verificado de verdade no passo 5 do design:** portão rápido (472 no backend, 225 no front: 58
novos, entre eles a bateria de uso, o catálogo de movimento e o aviso por navegação), portão pesado
do front, a suíte de ponta a ponta verde nos três projetos (161 casos, 1 pulado), com a saída
digitada tecla a tecla e os 6 casos novos de layout. O teste de uso do relógio foi provado contra a
versão da `v0.19.0`: 5 dos 7 casos falham nela (todos os de digitação) e passam na corrigida. Dois
achados da bateria que não eram defeito de uso, anotados nos próprios testes: o `user-event` não
faz o envio implícito com o botão fora do `<form>` (o navegador faz, pelo dono do formulário; o
teste prova a ligação), e o jsdom não termina a animação de fechamento do Base UI. O catálogo mostrou
um terceiro defeito, corrigido com teste antes de fechar: ao sair da conta num iPhone em aba, o aviso
"Você saiu da conta." e a dica de instalar ocupavam o mesmo lugar; a casca agora mostra um de cada
vez (versão nova, depois o aviso, depois a dica). Uma rodada do catálogo teve uma falha isolada no
detalhe com tarifas ("a partir de" não apareceu em 10 s, só no celular); repetida cinco vezes em
seguida passou todas, e a rodada seguinte do catálogo inteiro também. A causa não foi achada: o
contexto da falha se perdeu na repetição.

**Não verificado:** as View Transitions e a paralaxe num Safari 26 ou iPhone de verdade (a suíte
não mede animação); o teclado numérico do iPhone na hora e nos minutos, e o salto automático para os
minutos com o teclado aberto; a barra `sticky` com o teclado virtual aberto no iPhone (o Safari
redimensiona o viewport de um jeito próprio).

**Verificado de verdade no passo 4 do design:** portão rápido a cada commit (472 no backend, 161 no
front, 6 novos: calendário, rascunho de data e hora, vagas por passo, tarifas atrás do interruptor,
folhas da conta), portão pesado do front, a suíte de ponta a ponta verde nos três projetos (155
casos, 1 pulado) depois de quatro ajustes na suíte, não no produto: as linhas do trajeto voltaram a
ser filhas diretas do grupo (o localizador conta `> div`); "Hora" e "Minutos" exatos (os botões de
mais e menos contêm as palavras); o helper que escolhe a saída pula o calendário quando o dia está
travado; e, com a lista de lugares aberta, o Base UI marca o resto da página como `aria-hidden`,
então o toque fora que confirma a parada em texto livre vai por CSS, não por papel. Catálogo
refeito duas vezes (143 imagens): a primeira mostrou os cartões de dia esmagados na folha (a fileira
com rolagem lateral encolhia dentro da coluna) e a versão antes do grupo "BrazCar"; corrigido antes
da segunda. Conferidas por amostra: publicar vazio e preenchido, tarifas por parada com o aviso do
"a partir de", editar com a folha do dia travado, conta com e sem carro, folha de carro, entrar,
criar conta recusada.

**Não verificado:** a folha de data e hora por toque num iPhone (cartões, calendário, digitar a
hora); o interruptor e os botões de mostrar senha no aparelho; o `aria-hidden` que o Base UI põe no
resto da página com a lista de lugares aberta, para leitor de tela (parece comportamento modal
indevido num combobox e merece olhar no passo de qualidade).

**Verificado de verdade no passo 3 do design:** portão rápido a cada commit (472 no backend, 155 no
front, 22 novos: céu do horário, selo "Nova", seções e chips de dia, rascunho de hora, filtros como
chips, detalhe com o contato revelado), portão pesado do front, a suíte de ponta a ponta verde nos
três projetos (155 casos, 1 pulado) depois de dois ajustes: os localizadores de situação passaram a
ser exatos ("Lotada" também aparece na frase do passo de vagas) e o dono voltou a ver as próprias
observações, que a primeira versão do detalhe só mostrava ao passageiro. Catálogo refeito duas vezes
(143 imagens): a primeira rodada mostrou o selo "Nova" em todo card do primeiro carregamento, um
defeito do hook, corrigido com teste antes da segunda. Conferidas por amostra: mural cheio, busca
por apelido com a parada marcada e a linha do apelido, só com vaga, tempo real com uma "Nova",
minhas caronas em duas seções, contato revelado, dono, cancelada, importada.

**Não verificado:** a folha de horário e a de preço num toque de verdade (a suíte aplica o filtro
pela URL; a folha tem teste de componente do rascunho de hora, não de gesto); o arrastar para
fechar a folha (Drawer do Base UI) num iPhone; o céu do horário e o vidro da barra de ação no
aparelho; a paralaxe não existe ainda (passo 5).

**Verificado de verdade no passo 2 do design:** portão rápido a cada commit (472 no backend, 133 no
front, 5 novos: abas, toast, cartão de instalar, vazio), portão pesado do front, a suíte de ponta a
ponta verde nos três projetos (155 casos, 1 pulado) e o catálogo refeito com 143 imagens, conferidas
por amostra: mural com abas e cartão, sem internet, página inexistente, piso de versão, minhas
caronas vazia. A primeira rodada da suíte achou um defeito de verdade, não de teste: o fim de cada
página ficava sob a barra de abas ao rolar até um controle, e o cartão de instalar tampava o botão
que fecha um formulário; corrigido com `scroll-padding` no `html` e o cartão só no mural. Nas fotos
de página inteira do celular, as superfícies fixas aparecem na posição do primeiro viewport, no meio
da lista: é como o Playwright fotografa página inteira, não a tela.

**Não verificado:** o cabeçalho encolhendo e a barra compacta num Safari 26 ou Chrome de verdade (a
suíte não rola o mural para isso; o Chromium do Playwright tem `animation-timeline`, mas ninguém
afirmou nada sobre o resultado); o vidro das abas e a área segura num iPhone instalado; os ícones
novos na tela de início do iPhone e o maskable no Android; o `inert` da página sem internet num
iPhone.

**Verificado de verdade no passo 1 do design:** portão rápido (472 testes no backend, 128 no front,
53 deles novos: tema, fonte, orçamento de tokens e os primitivos por comportamento), portão pesado
do front com o build (a fonte em `dist/fonts/`, 28 KiB), a suíte de ponta a ponta verde nos três
projetos (celular, desktop e celular no tema escuro: 155 casos, 1 pulado) e o catálogo refeito com
143 imagens, conferidas por amostra: mural, conta com o controle de tema, entrar, publicar com a
recusa, diálogo de cancelar, sem internet e o desktop. O tema escuro provado pela suíte inteira, não
por print. O gate de memória: com menos de 3 GB livres o vitest não sobe os workers; `--maxWorkers=2`
resolve na mão e o hook passou sem isso quando a máquina esvaziou.

**Não verificado:** o tema escuro e a barra de status translúcida num iPhone de verdade, instalado e
em aba (a suíte roda no Chromium e não vê a barra do Safari); a fonte carregando pelo endereço
publicado, com o `preload` e o service worker, e o salto de layout que a `Bricolage Fallback`
deveria zerar; LCP e CLS antes e depois pelo endereço publicado (a medição pela Performance API fica
para o deploy, porque o build local não representa a rede do celular); o `theme-color` acompanhando a
escolha manual na barra do Safari. Ainda de antes: a cobertura do front nesta máquina (`@vitest/coverage-v8` não está instalado
aqui; roda no fluxo do GitHub); as telas no WebKit e num iPhone de verdade (a suíte roda os dois
projetos no Chromium, D-134); o interpretador lendo preços por parada contra um Ollama de verdade
(o golden set não mede `fares`, e as 120 mensagens não trazem o julgamento esperado desse campo);
as telas novas num celular. Ainda de antes: o front publicado mostrando o selo e a mensagem
original, no celular; o job do `pg_cron` apagando uma carona importada que partiu; o worker
sobrevivendo a panic do Go ou a reinício do Postgres; o mural atualizando sozinho ao voltar do
segundo plano no app instalado; o aviso de build novo e a tela de piso num iPhone; ícone maskable
no Android; `login` e `password-reset` estourados pelo navegador; e-mail de verdade pelo Resend.

**Pendências de design (D-103), depois do passo 6:** o balão de opinião no topo do mural (S14) não
entra: por decisão do Eduardo, a opinião fica só na Conta (D-155). O "Ver amanhã a partir de HH:MM" e a contagem de lotadas escondidas estão no ROADMAP.
O Base UI marca o resto da página como fora da árvore de acessibilidade enquanto a lista de lugares
está aberta (e, no jsdom, até o fim de uma animação que nunca termina): parece comportamento modal
indevido num combobox; fica para o passo de qualidade. O desktop usa a mesma casca do celular até o
canvas ganhar as pranchas de desktop. Manifesto com as cores do tema claro (é estático).

## Próximo passo

1. Etapa de design (D-103, D-143): o Eduardo conferir no celular os passos 5 e 6 publicados; depois,
   o desktop, quando o canvas tiver as pranchas.
2. Conferir no celular as caronas importadas no mural publicado: selo, mensagem original, contato,
   e as telas de observações e preço por parada.
3. Medir o interpretador lendo preço por parada contra o Ollama, anotando `fares` no golden set das
   mensagens que trazem lista de preços (as de número 25, 31, 34 e 41).
4. O que falta do passo de qualidade: Schemathesis sobre o contrato. A cobertura do front já passou
   a do backend (branch `feat/web-coverage`, à espera de auditoria).

## Pendências abertas

- Texto dos termos de uso e de privacidade ainda não foi escrito (D-033); o cadastro já grava o
  aceite e a tela já mostra a frase, sem link.
- Recuperação manual de senha para conta sem e-mail depende de admin, que só entra somente
  leitura (D-087); quem se cadastrou sem e-mail agora pode acrescentar um pela edição de dados
  pessoais (D-139) e passar a ter recuperação; sem isso, continua sem caminho.
- `tests/demo/test_seed_demo.py::test_seeds_everything_it_promises` falhava dependendo da hora do
  dia em que a semente rodava: `TOMORROW_MANY_STOPS` (27h da âncora) e `TOMORROW_REPEATED` (28h)
  caíam num terceiro dia de calendário quando a âncora (truncada na hora cheia) já estava tarde da
  noite, e `seeded.days` contava quatro dias em vez de três. Achado ao rodar o portão rápido, que o
  `pre-commit` exige, num passo que por si não mexia em `demo/`; consertado ali mesmo, porque sem
  isso nenhum commit deste passo passava pelo hook: os dois agora ficam a 26h40 e 26h50 da âncora,
  a menos de uma hora de `TOMORROW_EDITED`/`TOMORROW_EDITED_DELAYED` (26h/26h30), então os quatro
  sempre caem no mesmo dia de calendário entre si, qualquer que seja a hora cheia da âncora.
- O `Catalog` é carregado inteiro a cada requisição de `places` e a cada listagem do mural
  (`labels`); cachear por revisão se pesar.
- A normalização de texto existe duas vezes: `places/domain/search_key.py` e `search/domain/text.py`.
  A busca de lugares pode passar a usar o índice de `search` quando houver um terceiro uso.
- O índice de busca é alimentado depois da gravação, fora da transação: se a indexação falhar, a
  carona fica no mural mas não aparece na busca por texto até o próximo `index_rides`.
- A tabela de hits do limite cresce com o uso e só é podada por chave; um comando de limpeza
  entra se pesar.
- Rota `/api/diagnostics/sse`, página `/diagnostics` e `SSE_DIAGNOSTICS_TOKEN` ficam de propósito
  (D-107), como semente de uma telemetria própria, também do aparelho; a página não tem link na
  interface.
- Ao voltar do segundo plano com mudança no meio, o mural pode buscar duas vezes (foco e sinal):
  escolha registrada em D-104, não defeito.
- Teto de descritores do container da API não foi conferido.
- O extrator traz SQLAlchemy, Alembic, typer e tomlkit como dependências transitivas que o BrazCar não
  usa; tirá-las é assunto do repo dele (D-041).
- A imagem da API cresceu com `git` no build e `libmagic1` no runtime, exigências do extrator.
- O worker usa o número pessoal do Eduardo (D-110) até haver chip dedicado.
- D-126 diz que o passo de qualidade é o primeiro depois do 7a; o Eduardo decidiu fazer o 7b antes.
  A decisão não foi editada; a ordem real está aqui.
- Tarifa importada que não casa com nenhuma parada (ou casa com mais de uma) é descartada em
  silêncio, e a carona fica com as tarifas que sobraram, ou sem nenhuma. Ninguém vê o descarte; só
  o comando `candidates` mostra o que foi lido. Decidir se vale registrar o descarte em algum lugar.
- A normalização de texto agora existe três vezes (`places`, `search`, `importing`): candidata a
  `shared/domain` no próximo toque em qualquer uma delas.
- Sobrou uma pasta `.whatsapp_scrapping_wip/proj1/.pytest_cache` com permissão negada no
  Windows. Remover manualmente como administrador. Está no `.gitignore`.
- `docs/screens/{mobile,desktop}/publish/free-text-stop.png` ainda são da versão anterior, com a
  caixa "Outro lugar": o `yarn screens` que fecharia o passo do campo único (D-123) não pôde rodar
  de novo depois do ajuste fino no `PlacePicker` porque a máquina ficou sem memória disponível.
  Rodar `cd web && yarn screens` e conferir só essas duas imagens.
