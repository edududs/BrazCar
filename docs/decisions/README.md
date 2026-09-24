# Decisões

Tabela única de todas as decisões. Uma linha basta quando o motivo é evidente. Quando não é,
a coluna **Registro** aponta para um arquivo com contexto, decisão e alternativas descartadas.

**Status:** `decidido`, `proposto` (falta validar) ou `adiado` (fora do MVP, com intenção registrada).
Decisão não se edita: cria-se outra e marca-se a antiga como `substituída por D-NNN`.
Origem das linhas até D-068: entrevista de design de 18 a 20/09/2026. As seguintes nasceram na construção.

## Direção

| ID | Decisão | Status | Registro |
|---|---|---|---|
| D-001 | A plataforma é o núcleo e funciona sem o extrator de WhatsApp | decidido | |
| D-002 | Repo novo, monorepo com `src/` (Django) e `web/` (React), deploys separados | substituída por D-069 | |
| D-003 | Backend em Django 6 ASGI com django-ninja | decidido | |
| D-004 | Front em React 19, TypeScript, Vite, Tailwind v4 e yarn 4 | decidido | |
| D-005 | Hexagonal com DDD: domínio em Pydantic, Django só nos adaptadores | decidido | [0001](0001-hexagonal-ddd-django-in-adapters.md) |
| D-006 | Contextos `rides`, `accounts` e `places`, cada um com seu app Django dentro de `adapters/` | decidido | [0002](0002-bounded-contexts-own-django-app.md) |
| D-007 | Código, identificadores e nomes de arquivo em inglês; documentação e interface em pt-BR | decidido | |
| D-008 | Mínimo de serviços de terceiros. Aceitos: Vercel, Resend e Cloudflare | decidido | |
| D-069 | Monorepo com `backend/` e `web/` como pastas irmãs, cada uma dona do seu tooling; contrato em `contract/openapi.json`; a raiz guarda só o que é do repo inteiro | decidido | |
| D-070 | Python 3.14. Descer para 3.13 só se aparecer incompatibilidade real, em especial ao embutir o extrator | decidido | |
| D-125 | O repositório é público e faz parte do portfólio do dono. O `README.md` da raiz e [method.md](../method.md) são escritos para quem nunca viu o projeto e decide em poucos minutos se vale ler o resto. Toda afirmação neles aponta para a prova dentro do repo; nada de número, funcionalidade ou garantia sem lastro. Os outros documentos continuam sendo ferramenta de trabalho, escritos para quem constrói. A metodologia é descrita em documento próprio, em tom factual; commits e documentação seguem sem citar ferramenta de autoria (regra 9 do `AGENTS.md`) | decidido | |

## Caronas

| ID | Decisão | Status | Registro |
|---|---|---|---|
| D-009 | Só ofertas de motorista no MVP | decidido | |
| D-010 | Pedido de carona por passageiro é outro agregado | adiado | |
| D-011 | Conversão por link `wa.me`, sem reserva de vaga no app | decidido | |
| D-012 | Carona avulsa com botão "repetir esta carona", sem recorrência | decidido | |
| D-013 | Rota é sequência ordenada de paradas do catálogo, com opção "outro" em texto | decidido | |
| D-014 | Preço único por carona, `Decimal`, padrão R$ 7,00; pagamento em dinheiro ou PIX | decidido | |
| D-015 | Situação da carona é calculada, nunca gravada | decidido | [0003](0003-computed-ride-status.md) |
| D-016 | Aberta exige vaga; zerar vagas fecha; aumentar vagas reabre; "reaberta" é transição | decidido | [0003](0003-computed-ride-status.md) |
| D-017 | "Já saiu" vem do horário mais uma tolerância configurável, sem job agendado | decidido | [0003](0003-computed-ride-status.md) |
| D-018 | Edição em aberta e fechada; antes da partida só no mesmo dia; depois só adiar até 2h do horário original | decidido | [0004](0004-ride-edit-and-delay-rules.md) |
| D-019 | Cancelada é definitiva | decidido | [0004](0004-ride-edit-and-delay-rules.md) |
| D-020 | Entidades congeladas; mudança devolve cópia | decidido | |
| D-021 | Histórico em tabela só de acréscimo, alimentada por eventos de domínio | decidido | [0005](0005-append-only-ride-events.md) |
| D-022 | Pedidos de contato ficam em tabela própria, fora do histórico da carona | decidido | |
| D-023 | A carona guarda cópia dos dados do carro na publicação, além da referência | decidido | |
| D-093 | Parada do catálogo só entra se o lugar existir: `PublishRide` e `EditRide` conferem os identificadores contra o `PlaceDirectory` e recusam com `UnknownPlaceError` (422); texto livre não é conferido por ninguém | decidido | |
| D-094 | O repositório devolve as datas no fuso do mural (`TIME_ZONE`, `America/Sao_Paulo`), não em UTC: a regra do mesmo dia (ADR-0004) e o filtro por dia leem a data local, e o contrato de porta prova que o dia sobrevive ao banco. Não há coluna de fuso; a plataforma é de uma cidade só | decidido | |
| D-095 | Pedido de contato só em carona aberta ou reaberta (409 nas outras); o motorista nunca recebe `can_contact` na própria carona. Uma carona publicada nasce com pelo menos uma vaga (regra da API) | decidido | |
| D-099 | Na tela, a rota é "Sai de", "Vai para" e paradas no caminho opcionais, inseridas antes do destino; só as do meio se removem. O domínio não muda: duas paradas são o mínimo porque são a origem e o destino (D-013) | decidido | |
| D-101 | O filtro "passa por" do mural é texto livre (`?q=`), não identificador de lugar: casa com qualquer parada, do catálogo ou "outro", sem acento nem caixa, todos os termos presentes. Parada do catálogo é achada pelo nome, pelos apelidos e pelos nomes dos lugares acima dela ("Plano Piloto" acha a Esplanada). O casamento é da porta `RideSearch`, sobre o índice do contexto `search` (D-100) | decidido | |
| D-096 | O card do mural e toda resposta de escrita são o mesmo schema `RideOut`, com situação e ações calculadas para quem pede (ADR-0011); a rota de escrita relê a carona pelo `ShowRide` em vez de serializar a entidade | decidido | |
| D-121 | Tolerância de "já saiu" (D-017) passa a 10 minutos por padrão (`RIDE_DEPARTURE_TOLERANCE_MINUTES`); vale para toda carona, publicada ou importada | decidido | |

## Lugares

| ID | Decisão | Status | Registro |
|---|---|---|---|
| D-024 | `places` nasce como contexto próprio: nome canônico, apelidos, tipo, lugar pai, geometria vazia | decidido | [0002](0002-bounded-contexts-own-django-app.md) |
| D-025 | Modelagem de lugar como área e mapa de paradas | adiado | |
| D-083 | O agregado de `places` é o catálogo inteiro (`Catalog`), porque as invariantes atravessam lugares; a porta carrega e grava o catálogo todo, e busca, apelido e descendentes são resolvidos em memória, em Python, sem recurso de banco. Rever se o catálogo passar de centenas de lugares | decidido | |
| D-087 | O catálogo de `places` é mantido por um arquivo versionado (`backend/src/brazcar/places/adapters/catalog.toml`) e pelo comando idempotente `manage.py sync_places`, que passa pelo caso de uso e roda no entrypoint junto com a migração. O admin do Django não escreve em lugar nenhum; se entrar, é somente leitura, e só depois de `accounts` (D-028) | decidido | |
| D-084 | Identificador de lugar é um slug estável (`plano-piloto`): legível na semente e na URL do filtro do mural, e renomear o lugar não o muda | decidido | |
| D-122 | O catálogo ganha os bairros de Brazlândia como filhos de `brazlandia` (Rodeador, Vila São José, Veredas, Fassincra, Assentamento, Setor Tradicional, Setor Norte, Ouro Verde) e os pontos de Brasília que os grupos citam (Colônia 26 de Setembro, Acesso G, Esplanada, SAAN, Brasil 21, Pátio Brasil, SCS...), com apelidos nas grafias vistas. Quadras ("33/34", "5 norte") ficam como texto livre; entram como filhos de bairro quando houver terceiro uso | decidido | |

## Contas e privacidade

| ID | Decisão | Status | Registro |
|---|---|---|---|
| D-026 | Conta única: telefone, senha e nome social obrigatório; e-mail opcional | decidido | |
| D-027 | Sem verificação de telefone no MVP; campo de verificado já previsto | decidido | |
| D-028 | Usuário customizado do Django desde a primeira migration; `Account` é do domínio | decidido | |
| D-029 | Publicar exige carro cadastrado: modelo, cor e placa; vários carros por conta | decidido | |
| D-030 | Mural público sem login; toda interação exige login | decidido | [0006](0006-contact-gated-phone-and-plate.md) |
| D-031 | Telefone e placa só saem pela rota de contato, com limite por conta e registro | decidido | [0006](0006-contact-gated-phone-and-plate.md) |
| D-032 | Recuperação de senha por e-mail via Resend (SMTP), atrás de porta; manual como último recurso | decidido | |
| D-033 | Termos no cadastro e exclusão de conta com anonimização já no MVP | decidido | |
| D-034 | Verificação de telefone por OTP reverso via WhatsApp | adiado | |
| D-089 | Telefone é celular brasileiro com DDD, aceito como a pessoa digita e guardado em E.164 (`+5561999990001`); placa aceita o formato antigo e o Mercosul e guarda maiúsculas sem hífen. Os dois são value objects do domínio; a senha nunca entra no domínio, é credencial do adaptador | decidido | |
| D-090 | Identificador de conta é UUID gerado no domínio, e a linha do usuário do Django usa o mesmo UUID como chave: `rides` referencia a conta sem esperar o banco, e a exclusão apaga no lugar (telefone, nome, e-mail, carros e senha somem; a linha e o identificador ficam para o histórico) | decidido | |
| D-091 | A checagem de `Origin` de D-059 é um middleware em `shared/adapters`: método que altera estado exige `Origin` igual à própria origem ou a uma de `CORS_ALLOWED_ORIGINS`; requisição sem `Origin` só passa sem cookie (ferramenta de linha de comando, healthcheck). Não há token de CSRF, porque ele não atravessa origens | decidido | |
| D-092 | Recuperação de senha: pedido sempre responde `ok`, e só envia e-mail se a conta tem e-mail; o token é o gerador do Django (`<uid>.<token>`, morre ao ser usado, vence em uma hora) e o link aponta para a página do front em `PASSWORD_RESET_LINK`. Sem e-mail configurado, o backend de e-mail é o console | decidido | |

## Persistência

| ID | Decisão | Status | Registro |
|---|---|---|---|
| D-035 | Banco único e plugável pelo ORM: SQLite ou Postgres para tudo | decidido | [0007](0007-pluggable-database-dual-contract.md) |
| D-036 | Produção com Postgres em container no próprio compose | decidido | |
| D-037 | Supabase, se usado, é só host de Postgres, com a Data API desligada | decidido | |
| D-038 | O adaptador grava cada agregado numa função síncrona com `atomic` | decidido | [0008](0008-sync-atomic-per-aggregate.md) |
| D-039 | Contrato de repositório roda em SQLite e em Postgres | decidido | [0007](0007-pluggable-database-dual-contract.md) |
| D-085 | Contrato de porta é uma classe em `backend/tests/contracts/`, herdada uma vez por implementação (o fake em memória e o adaptador Django, este marcado `contract`). O banco é escolhido como em produção, por `DATABASE_URL`: `poe test` roda em SQLite e `poe test-postgres`, parte do portão pesado, repete os `contract` no Postgres do compose, com `EXPECT_DB_VENDOR` para não passar no banco errado | decidido | |

## Extrator de WhatsApp

| ID | Decisão | Status | Registro |
|---|---|---|---|
| D-040 | Tabelas `whatsmeow_*` isoladas por usuário de banco com `search_path` próprio (`infra/postgres/whatsapp-role.sql`; testado em 2026-09-23: as 17 tabelas nascem no schema `whatsapp`, nenhuma em `public`; a DSN precisa de `sslmode=disable` na rede interna) | decidido | [0009](0009-extractor-via-django-store.md) |
| D-041 | O repo do extrator nunca é alterado a partir daqui; ele só extrai, nunca envia | decidido | [0009](0009-extractor-via-django-store.md) |
| D-042 | `DjangoStore` implementa a porta de escrita do extrator, no lugar de SQLAlchemy e Alembic | decidido | [0009](0009-extractor-via-django-store.md) |
| D-043 | O extrator roda como management command em serviço próprio, com reinício automático | decidido | [0009](0009-extractor-via-django-store.md) |
| D-044 | A importação lê da tabela de mensagens com marcador; o evento só acorda o consumidor | decidido | [0009](0009-extractor-via-django-store.md) |
| D-045 | Contexto `importing`: mensagem candidata, revisão, vira carona | substituída por D-113 | |
| D-108 | O extrator roda como serviço `worker` do `infra/compose.yml`, na mesma imagem da API, com `manage.py run_extractor`: um processo por conta, `restart: unless-stopped`, sem `RUN_MIGRATIONS`, esperando a API saudável. Pareamento uma vez por `docker compose run --rm worker python manage.py pair_whatsapp`, com o QR no terminal do ssh; a sessão fica no Postgres, sem volume. O Ollama do host é alcançado por `host.docker.internal` | decidido | |
| D-109 | Grupos observados são uma lista de JID com rótulo em variável de ambiente fora do repo (`WHATSAPP_GROUPS`), nunca por nome: o extrator devolve nome nulo para grupo, e JID antigo embute o telefone de quem criou o grupo, então a lista não é versionada e o rótulo é o que a interface mostra. Grupo novo entra editando o env e reiniciando o worker; a lista é aprovada pelo Eduardo antes de cada deploy | decidido | |
| D-110 | Até o fim do passo 7 o worker usa o número pessoal do Eduardo, só leitura, sem enviar nada; chip dedicado do BrazCar depois. Banimento por leitura é improvável; envio automatizado é o que o WhatsApp pune | decidido | |
| D-111 | O `DjangoStore` guarda só mensagens de texto de grupo, não vazias e não enviadas pela própria conta, em colunas tipadas (conta, id da mensagem, JID do grupo, telefone e nome do remetente, enviada em, texto, recebida em), sem o JSON do `Message` inteiro e sem mídia; unicidade por (conta, id da mensagem) | decidido | [0009](0009-extractor-via-django-store.md) |
| D-112 | O consumidor da importação vive no processo do worker como tarefa asyncio: o handler do extrator só a acorda (D-044), ela varre as pendências ao subir e a cada minuto, e julga uma candidata por vez. Panic do Go derruba os dois e o restart recomeça pela tabela | decidido | |

## Importação

| ID | Decisão | Status | Registro |
|---|---|---|---|
| D-113 | Contexto `importing` (substitui D-045): mensagem-fonte vira candidata por remetente, chave de texto normalizado e janela de 6h (a mesma carona em quatro grupos é uma candidata com quatro fontes); a candidata é julgada e, aceita, vira carona. Cada etapa é idempotente: reprocessar mensagem não cria segunda candidata, reprocessar candidata não cria segunda carona, e repostagem do mesmo remetente para a mesma partida (mesmo minuto) se junta à carona existente | decidido | [0015](0015-imported-ride-model.md) |
| D-114 | Carona importada mora em `rides`: `RideOffer.driver` é tipo-soma `RegisteredDriver` (conta e carro) ou `ExternalDriver` (telefone e nome do WhatsApp), e `origin` é `Published` ou `WhatsApp` (texto original, rótulo do grupo, enviada em). Sem conta-sombra: reivindicar a carona ao cadastrar o mesmo telefone só depois da verificação de posse (OTP reverso), porque hoje qualquer usuário logado obtém o telefone pela rota de contato | decidido | [0015](0015-imported-ride-model.md) |
| D-115 | Julgamento: porta `RideParser`, adaptador Ollama com JSON schema derivado do tipo Pydantic (plano: `kind` oferta, pedido, atualização ou outro, mais campos opcionais), `temperature 0` e few-shot em pt-BR. O modelo devolve paradas como texto e horário relativo; lugar e data são resolvidos em código. A confiança é calculada por conferências ancoradas no texto, nunca declarada pelo modelo. Sempre pelo LLM, uma candidata por vez. Modelo: o menor que passar no golden set (gemma3:4b ou qwen3.5:4b), 7B só se falhar; fake determinístico no portão rápido | decidido | [0016](0016-llm-extracts-rules-verify.md) |
| D-116 | Aceite automático, sem fila: oferta com horário resolvido, duas paradas (do catálogo ou texto livre) e confiança acima de `IMPORT_ACCEPT_THRESHOLD`. Vagas ausente vale 2, preço ausente vale R$ 7,00, pagamento ausente vale dinheiro e PIX. As demais candidatas ficam com o motivo, visíveis no admin somente leitura até a poda | decidido | |
| D-117 | Carona importada aparece no mesmo mural com selo "via WhatsApp", sem carro e sem ação de dono; expira só pelo horário. O detalhe mostra o texto original, o rótulo do grupo e quando foi enviada. Contato exige login e limite como hoje e devolve `wa.me` do remetente, sem placa. Confiança não aparece na interface | decidido | |
| D-118 | No passo 7 só há criação: "lotou", "só 1 vaga" e "cancelei" são classificadas como atualização e guardadas sem efeito. Aplicar atualização por mensagem posterior é o incremento seguinte | decidido | |
| D-119 | Dado mínimo: só texto, nunca mídia. Carona importada, candidata e mensagens-fonte são apagadas juntas quando a carona vira "já saiu"; mensagem que não virou carona é apagada 24h depois do julgamento; nada fica em histórico. Remetente que pedir para sair entra numa lista de bloqueio e tudo dele é apagado. A poda é uma porta com dois adaptadores, `pg_cron` no Postgres da máquina e varredura no processo do worker em SQLite, com contrato provando que as duas regras são a mesma | decidido | |
| D-124 | Inspeção das mensagens-fonte por comando (`manage.py source_messages`), não pelo admin do Django: o admin exigiria arquivos estáticos servidos pelo container, um superusuário e uma tela de login exposta no host da API, para uma leitura que cabe num comando pelo ssh. Candidatas seguem o mesmo caminho no 7b, no lugar do "admin somente leitura" que D-116 cita; o admin continua como em D-087, só se algum dia entrar | decidido | |
| D-127 | Se o telefone do remetente já é de uma conta, a carona importada nasce vinculada a ela: `RegisteredDriver` sem carro (ninguém sabe qual foi), origem WhatsApp, selo "via WhatsApp", em "minhas caronas", com vagas e cancelar para o dono; o contato vai ao telefone da conta, sem placa. Só o caso inverso, conta criada depois da carona, continua adiado para o OTP (ADR-0015). Risco assumido: sem verificação de posse (D-027), quem se cadastrar com o número de outro motorista recebe as caronas importadas dele; é o mesmo buraco de publicar em nome alheio, e o OTP fecha os dois. Uma carona vinculada é do dono e não é apagada pela poda; só a de motorista externo é | decidido | |
| D-128 | O texto original guardado na carona (D-117) passa por redação determinística antes de sair de `importing`: sequências que parecem telefone, e-mail ou placa viram `[…]`. O mural é público e o levantamento achou chave Pix, e-mail e placa dentro das ofertas; o telefone do remetente continua saindo só pela rota de contato (D-031) | decidido | |
| D-129 | A carona publicada ganha `notes`: texto livre opcional de até 500 caracteres, sem formatação, em publicar, editar e repetir; o card mostra uma linha cortada e o detalhe mostra inteiro. O campo recusa sequência que pareça telefone, e-mail ou placa (422, "contato só pelo botão"), em vez de redigir como faz a importação (D-128): quem publica é dono e corrige; o detector das duas regras é peça de `shared` (`shared/domain/personal_data.py`), para não haver duas expressões divergindo. A busca "passa por" (D-101) não indexa observações. A importação não preenche `notes` por ora, o texto original cobre; extrair "OBS:" para o campo é refinamento futuro do parser. Implementado num passo curto próprio, antes da etapa de design (D-103), porque muda domínio e contrato | decidido | |
| D-130 | Reprocessamento manual: `manage.py import_rides --rejudge [--since AAAA-MM-DD]` devolve a pendente o que foi julgado desde o início do dia (hoje, por padrão) e tira do mural as caronas de motorista externo que essas candidatas criaram, para a próxima varredura ler as mesmas mensagens de novo. Carona vinculada a conta é do dono e fica. Ferramenta de controle e de teste, não rotina; as mensagens precisam ainda estar no banco (retenção de 24h, D-119). O interpretador passa a guardar até 15 paradas e, acima disso, corta do meio, nunca a origem nem o destino | decidido | |
| D-131 | Preço por parada: cada parada da rota ganha `fare` opcional, "preço para ir até aqui" contado a partir da origem, como os grupos escrevem ("R$ 7 → Estrutural, R$ 9 → Aeroporto"). Com tarifas, o `price` da carona deixa de ser digitado e passa a ser a menor delas, o "a partir de" que o card mostra e o filtro de preço máximo usa; sem tarifas, nada muda. O detalhe lista a tarifa ao lado de cada parada; publicar, editar e repetir aceitam tarifas; o interpretador devolve pares parada e valor, casados com as paradas pelo texto e conferidos contra as palavras da mensagem (D-115). Preço dependente do ponto de embarque fica fora: é o que exigiria remodelar a rota, e nenhuma mensagem dos grupos o usa. Implementado no mesmo passo curto das observações (D-129), antes da etapa de design (D-103). Substitui a intenção "preço por trecho" do ROADMAP | decidido | |
| D-120 | Golden set: mensagens reais dos grupos, anonimizadas (remetente, telefone, e-mail, placa e nome trocados), versionadas em `backend/tests/importing/golden/` com o julgamento esperado. Roda no portão pesado contra o Ollama; é o que permite trocar de modelo | decidido | |

## Tempo real e PWA

| ID | Decisão | Status | Registro |
|---|---|---|---|
| D-046 | Revisão do mural no banco, sinal por SSE, contador lido uma vez por segundo | decidido | [0010](0010-board-revision-sse-signal.md) |
| D-047 | Celular espera até 2s aleatórios antes de buscar; lista em cache por revisão | decidido | [0010](0010-board-revision-sse-signal.md) |
| D-048 | Buscar de novo ao focar a aba e ao voltar a rede, sempre | decidido | [0010](0010-board-revision-sse-signal.md) |
| D-049 | Primeira tarefa técnica: testar SSE pelo túnel do Cloudflare num iPhone | decidido | [0010](0010-board-revision-sse-signal.md) |
| D-050 | `LISTEN/NOTIFY` como segundo adaptador da mesma porta | adiado | |
| D-051 | PWA online-only: sem rede, tela de aviso | decidido | |
| D-052 | Atualização do app em modo `prompt` e piso de versão informado pela API | decidido | |
| D-076 | SSE confirmado pelo túnel: eventos um a um (atraso médio 35 ms), HTTP/2 na borda, 100 conexões por ~10 MiB; no iPhone a conexão morre em segundo plano e volta em ~1s. Consulta condicional não é necessária | decidido | [0013](0013-sse-through-tunnel-verdict.md) |
| D-077 | Batimento SSE é evento `ping` a cada 15s, não comentário; reconectar é caminho feliz; ao voltar ao foco a conexão tem 3s para provar que vive; rajada ao acordar vale um sinal só | decidido | [0013](0013-sse-through-tunnel-verdict.md) |

## Front

| ID | Decisão | Status | Registro |
|---|---|---|---|
| D-053 | Organização por funcionalidade, com quatro camadas dentro de cada uma | decidido | |
| D-054 | A API devolve a situação calculada e as ações permitidas; o front não recalcula regra | decidido | [0011](0011-server-computed-status-and-actions.md) |
| D-055 | Tipos gerados do OpenAPI do ninja, confinados aos adaptadores | decidido | |
| D-056 | TanStack Router e TanStack Query | decidido | |
| D-086 | A saída da API é um schema explícito no adaptador (`PlaceOut`), não a entidade serializada: o contrato público só muda de propósito, e é o mesmo caminho que a regra de privacidade de `rides` e `accounts` vai exigir | decidido | |
| D-057 | Primitivos sobre biblioteca headless, com Tailwind v4 e tokens em variáveis CSS | decidido | |
| D-088 | A biblioteca headless é o Base UI (`@base-ui/react`): cobre combobox, diálogo, menu, drawer, select e toast estáveis, estiliza por `data-*` direto no Tailwind v4 e declara React 19. Os primitivos ficam embrulhados em `web/src/shared/ui/`, para que uma troca custe reescrever o primitivo, não as telas | decidido | |
| D-071 | TypeScript fica na 6.0.x: a 7 (porta nativa) não expõe a API de compilador que o typescript-eslint e o openapi-typescript usam. Subir quando os dois suportarem | decidido | |
| D-072 | Rotas do TanStack Router por arquivo em `web/src/routes/`, finas, só compondo; `routeTree.gen.ts` é gerado e versionado | decidido | |
| D-073 | Em desenvolvimento o Vite faz proxy de `/api` para a API local; em produção o front usa `VITE_API_BASE_URL` | decidido | |
| D-123 | Paradas por um campo só, com autocomplete do catálogo e texto livre aceito, sem select e sem "outro": decidido agora, implementado na etapa de design (D-103), porque refaz o formulário de publicar | decidido | |

## Deploy e operação

| ID | Decisão | Status | Registro |
|---|---|---|---|
| D-058 | Endereços `brazcar.elj-labs.org` e `api-brazcar.elj-labs.org`, ambos de primeiro nível | decidido | [0012](0012-session-cookie-sibling-origins.md) |
| D-059 | Cookie de sessão httpOnly `SameSite=Lax`, CORS com credenciais, checagem de `Origin` | decidido | [0012](0012-session-cookie-sibling-origins.md) |
| D-060 | Front no Vercel; API na máquina de teste por compose, Traefik e túnel do Cloudflare | decidido | |
| D-061 | Migração no entrypoint, ligada por `RUN_MIGRATIONS=1` só na API; worker espera a API saudável | decidido | |
| D-062 | Admin do Django escreve só em `places`; resto somente leitura; moderação chama caso de uso | substituída por D-087 | |
| D-063 | Observabilidade: logs JSON e endpoint de saúde, sem terceiros | decidido | |
| D-064 | Limite de requisições na aplicação, atrás de porta | decidido | |
| D-065 | Testes: arquitetura por AST, domínio, Hypothesis, contrato nos dois bancos, Schemathesis, E2E, hooks do front | decidido | |
| D-066 | GitHub roda só o portão rápido; testes pesados rodam localmente em `pre-push` | decidido | |
| D-067 | Imagens no GHCR, publicadas ao criar tag | decidido | |
| D-068 | Ordem de construção: esqueleto, teste do SSE, `places`, `accounts`, `rides`, front | decidido | |
| D-074 | Hooks são scripts versionados em `.githooks/`, ligados por `core.hooksPath` (`uv run poe hooks`), sem o framework pre-commit; cada portão só roda se o caminho dele mudou | decidido | |
| D-075 | `domain/` e `application/` de um contexto podem importar as mesmas camadas de `shared`, nunca as de outro contexto; o teste de arquitetura cobre isso | decidido | |
| D-078 | API em uvicorn, um processo por container (o sinal do mural é uma tarefa por processo web); a imagem traz o próprio healthcheck, que se apresenta com o primeiro host permitido | decidido | |
| D-080 | Encerramento de passo segue `docs/runbooks/close-step.md`: Conventional Commits, SemVer com a versão calculada dos commits, `CHANGELOG.md` gerado pelo git-cliff no formato Keep a Changelog, tag anotada com as notas e GitHub Release criada a partir da tag. A tag é a fonte da verdade da versão | decidido | |
| D-082 | Uma versão só para a release inteira: a tag é a fonte, o pacote do backend a acompanha, a API lê a versão do pacote instalado, e o contrato e os tipos do front são regerados no corte da release. Versão de contrato independente só quando existir cliente externo da API | decidido | |
| D-081 | A imagem da API é pública e a máquina de teste a puxa como anônimo, com um `DOCKER_CONFIG` próprio e vazio em `~/.brazcar/docker`; sem token de GHCR para o BrazCar | decidido | |
| D-079 | CORS por `django-cors-headers`, com origens explícitas vindas do ambiente; é a parte de D-059 que já existe | decidido | |
| D-126 | Verificação feita à mão durante um passo (fluxo no navegador, rota por `curl`, comportamento de tela) vira teste automatizado no mesmo passo, e bugfix entra com o teste que o reproduz; o alvo é que nenhum passo quebre em silêncio o que outro deixou funcionando. No front isso inclui componentes e seus comportamentos, além dos hooks, com meta de cobertura igual à do backend; por isso a cobertura do front é medida sobre o `src` inteiro, e não sobre as camadas testadas, para que o número mostre a lacuna. O Schemathesis sobre o OpenAPI e o E2E com Playwright nas jornadas críticas, com screenshots como evidência, já constavam em D-065 e nunca foram feitos: entram num passo próprio de qualidade, o primeiro depois do 7a | decidido | |
| D-100 | Busca por texto é um contexto próprio, `search`, feito para sair do projeto: domínio e aplicação só importam a stdlib, e a porta é um índice (`SearchIndex`: `put`, `remove`, `search(query, among)`). A regra de casamento mora no domínio (`matches`) para todo adaptador responder igual. O primeiro adaptador é uma tabela com o texto normalizado e um `contains` por termo, igual em SQLite e Postgres; Redis ou Elasticsearch entram como outro adaptador. O índice é dado derivado: os casos de uso o alimentam depois de gravar, e `manage.py index_rides`, no entrypoint, o reconstrói | decidido | |
| D-102 | Toda página tem a mesma barra de navegação no topo (mural, publicar, minhas caronas, conta ou entrar), no layout raiz; entrar e cadastrar levam ao mural. Na conta, carro é opcional e fica fechado até ser pedido | decidido | |
| D-103 | Até o fim do MVP as telas são funcionais e sem polimento: primitivos existentes, sem identidade visual, sem motion, sem ajuste fino. O design do produto é uma etapa própria, depois que todas as peças existirem; nenhum passo antes dela gasta tempo em visual | decidido | |
| D-097 | Limite de requisições (D-064) é a porta `RateLimiter` em `shared/application`, com chave, limite e janela decididos pelo caso de uso (`contact:<conta>` 20 por 24h; `login:<telefone>` 10 por 15 min; `password-reset:<telefone>` 3 por hora). O adaptador é uma tabela de hits em `shared` (`shared_rate_limit_hit`), exata e igual em SQLite e Postgres; login estourado responde 429 e recuperação de senha estourada cai em silêncio, como telefone desconhecido | decidido | |
| D-098 | A revisão do mural e o sinal (ADR-0010) são portas de `shared/application` (`BoardRevision`, `BoardSignal`), não de `rides`: `rides` incrementa a linha `shared_board_revision`, semeada pela migration, dentro da própria transação; o adaptador `PollingBoardSignal` só mantém a tarefa de leitura enquanto há assinante, e `publish` é o atalho para escritor do mesmo processo. A rota `GET /api/rides/signal` já serve `revision` e `ping` a cada 15s (D-077), e o front invalida o mural após espera aleatória de até 2s (D-047) | decidido | |
| D-104 | Ao reconectar, o primeiro quadro do stream do sinal já é a revisão atual e é ele que se compara com a última vista: só busca se mudou, sem `GET /api/rides/revision` a mais. Enquanto uma busca espera o atraso aleatório, revisões novas se juntam a ela (rajada ao acordar vale uma busca, qualquer que seja o sorteio); uma revisão que chega com a busca já em voo agenda outra, e a invalidação cancela a velha. A busca ao focar e ao voltar a rede é explícita (`always`), mesmo com a conexão viva; ao voltar do segundo plano com mudança no meio isso custa até duas buscas, a do foco e a do sinal, e é escolha, não defeito | decidido | |
| D-105 | Piso de versão (D-052): `GET /api/web-version` em `shared` devolve `{minimum}`, lido de `WEB_MINIMUM_VERSION` (`MAJOR.MINOR.PATCH`, `0.0.0` é sem piso; valor malformado derruba a subida). A versão do front é o `version` do `web/package.json`, injetada no build como `__APP_VERSION__`; o `scripts/release.sh` a acompanha com a tag, como a do backend (D-082). O front compara as três partes como números, ignorando qualquer sufixo; abaixo do piso mostra a tela de atualização obrigatória. Sem resposta da API, ou resposta que não entende, vale sem piso: o piso é freio de emergência, não pode trancar o app | decidido | |
| D-106 | Forma do PWA (D-051, D-052): `vite-plugin-pwa` em `generateSW`, `registerType: prompt`, manifesto no `vite.config.ts`, precache só da casca com `navigateFallback` e nenhum `runtimeCaching` (a API nunca vai para o cache). O service worker é um adaptador só (`shared/adapters/service-worker.ts`), que procura build novo também ao voltar ao foco, porque app instalado quase não navega. Sem rede, detectada só por `navigator.onLine` num adaptador, a raiz mostra "Sem internet" por cima da página, que continua montada para não perder formulário, e os murais em cache são zerados para voltarem frescos. Atualizar com formulário de carona aberto pede confirmação (registro de trabalho não salvo em `shared/app`). A dica de "Adicionar à Tela de Início" só aparece no iPhone em aba do navegador e, dispensada, não volta naquele aparelho. Barra de status `default` (opaca, texto escuro) com `viewport-fit=cover` e margens de `safe-area` na barra de navegação e no rodapé; a versão do build fica no rodapé. Ícones são provisórios (D-103). Service worker no iOS só registra em contexto seguro: teste de PWA no celular é pelo HTTPS publicado, nunca por IP da rede local | decidido | |
| D-107 | Medido com o app instalado (`standalone`) num iPhone: o adaptador cobre todos os casos sem mudança, sem rajada ao acordar e com o JavaScript vivo 3 a 4s depois de sair. Troca de rede pela Central de Controle mata a conexão sem evento nenhum, então o vigia de silêncio do mural cai de 45s para 35s. Rota, página de diagnóstico e `SSE_DIAGNOSTICS_TOKEN` ficam, como semente de telemetria, sem link na interface | decidido | [0014](0014-sse-standalone-measurement.md) |

## Por que algumas linhas não têm registro

D-088: o React Aria Components tem o combobox mais maduro e a acessibilidade em iOS mais testada, mas não tem drawer (compõe-se à mão com `Modal` e `Dialog`), o toast estava em alfa e as dependências de React 19 ainda davam aviso; o Base UI só ganhou itens controlados no combobox em setembro de 2026, e o embrulho em `shared/ui` é o seguro contra isso. D-087: o admin exige `auth` e sessões, e o usuário customizado tem de existir antes da primeira migration deles (D-028); antecipar `accounts` quebraria a ordem de D-068, e o admin gravaria por fora do agregado, o que obrigaria a duplicar as invariantes do catálogo em `clean()`. Com o arquivo, o catálogo é revisável em commit e igual em todo ambiente. D-080: release-please e semantic-release automatizam o mesmo, mas decidem no GitHub; aqui a versão é cortada localmente, o push continua sendo do dono, e o GitHub só transforma a tag em release. D-081: o login de `ghcr.io` guardado no usuário da máquina é de outro projeto e faz o registro responder `denied` até para imagem pública; um token novo resolveria, mas seria um segredo a mais para guardar e renovar sem necessidade. Se a imagem virar privada, o caminho é o do JayceFinance: token clássico só com `read:packages`, `docker login` por stdin nesse mesmo diretório. D-078: o granian foi considerado; conexões SSE ociosas são tarefas asyncio paradas, a 0,1 MiB cada,
e o uvicorn já era o servidor de desenvolvimento e o dos logs JSON. D-061: o passo de migração separado protegeria contra falha antes da troca, mas num ambiente de
teste com uma API só o entrypoint é mais simples. D-058: `api.brazcar` seria de segundo nível e
fora do certificado grátis. D-032: o envio de e-mail do Cloudflare exige plano pago; o Resend é
gratuito nesse volume e fala SMTP. D-066: o Postgres no GitHub alongaria cada execução.
