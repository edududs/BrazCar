# Contexto `importing`

Transforma mensagens dos grupos de WhatsApp em caronas do mural. Só lê: nunca envia nada (D-041).
Depende do extrator embutido (ADR-0009) e entrega para `rides` por porta (ADR-0015).

## Glossário

| No negócio | No código | O que é |
|---|---|---|
| conta pareada | `account` | O número de WhatsApp que o worker lê, também um `PhoneNumber`. Um processo por conta (D-043); a sessão fica no banco. |
| grupo observado | `WatchedGroup` | JID de grupo e rótulo, da variável de ambiente `WHATSAPP_GROUPS` (D-109). Só o que está na lista é gravado; o rótulo é o que a interface mostra. |
| mensagem-fonte | `SourceMessage` | Mensagem de texto de um grupo observado, gravada pelo `DjangoStore` (D-111): conta, id da mensagem, JID do grupo, remetente, enviada em, texto, recebida em. Única por (conta, id). Tomada por uma candidata, vive e morre com ela. |
| remetente | `Sender` | Telefone e nome de exibição de quem postou. O telefone é o `PhoneNumber` de `shared` (D-135), lido do JID por `from_jid_user`, que devolve o nono dígito a endereço antigo (D-138), e gravado em dígitos sem `+`. É a identidade do motorista externo e a chave para achar uma conta (D-127). Qualquer número válido serve (D-137). |
| chave de texto | `text_key` | O texto sem acento, sem caixa, só letras, dígitos e espaço simples. Duas mensagens com a mesma chave são a mesma postagem. |
| janela de junção | `DEDUP_WINDOW` | 6 horas. Mensagem com o mesmo remetente e a mesma chave, enviada dentro da janela da primeira, entra na candidata existente; fora dela abre outra. |
| candidata | `Candidate` | Uma postagem, com uma ou mais mensagens-fonte (`sources`), o texto da primeira, o rótulo do primeiro grupo, primeira e última vez vista, e o veredito. Raiz do agregado. |
| veredito | `Verdict` | Tipo-soma: pendente `Pending`, aceita `Accepted(ride_id, joined)`, rejeitada `Rejected(reason, confidence)`, falhou `Failed(error, attempts)`. Só a aceita tem carona. |
| motivo de rejeição | `RejectReason` | `not_an_offer`, `no_time`, `no_seats`, `few_stops`, `low_confidence`, `unknown_place`. |
| interpretador | `RideParser` | Porta: texto, enviada em e rótulo do grupo entram; `ParserOutput` sai. Adaptador `OllamaRideParser` em produção (D-115); `ScriptedParser` nos testes. |
| saída do interpretador | `ParserOutput` | O tipo plano que vira JSON schema para o modelo: `kind`, `time` ("HH:MM"), `day`, `stops` como escritas, `seats`, `price`, `fares`, `payment_methods`, `closed`. `to_judgement` o converte; o que o modelo escreveu mal vira "não disse", nunca erro. |
| preço por parada | `StopFare`, `OfferFare` | Um par de palavras e valor ("R$ 9,00 → Aeroporto"), como o modelo devolve e como o domínio o guarda (D-131). Qual parada é cada par não sai do modelo. |
| julgamento | `Judgement` | Tipo-soma do que a mensagem é: oferta `Offer`, pedido `Request`, atualização `Update`, outro `Other`. Só a oferta vira carona (D-009). |
| oferta interpretada | `Offer` | Hora `at` e dia `Day` (hoje, amanhã, não disse), paradas como texto em ordem, vagas, preço, formas de pagamento; tudo opcional. |
| resolução de parada | `StopResolver` | Porta para `places`: cada texto de parada vira `ResolvedStop` com o lugar do catálogo cujo nome ou apelido é exatamente aquele, ou sem lugar (texto livre). O modelo nunca escolhe identificador. |
| casamento de tarifa | `attach_fares` | Função pura: cada par parada e valor vira a tarifa da única parada que aquelas palavras nomeiam, se o valor também aparece na mensagem (D-131). |
| resolução de horário | `resolve_departure` | Função pura: enviada em, `Day` e hora viram `departure_at` no fuso do mural. Hora já passada sem "hoje" cai no dia seguinte (a oferta da manhã é postada na noite anterior). |
| conferências | `Checks` | Determinísticas, ancoradas no texto: a hora aparece nos dígitos, as vagas aparecem, o preço aparece, que fração das paradas aparece, quantas o catálogo conhece. Campo que a mensagem não deu conta como conferido. |
| confiança | `Checks.confidence` | Número de 0 a 1 com pesos fixos no domínio (hora 0,35; paradas 0,35; vagas 0,15; preço 0,15), nunca declarado pelo modelo. |
| limiar de aceite | `IMPORT_ACCEPT_THRESHOLD` | Abaixo dele a oferta é rejeitada por `low_confidence` (D-116). Padrão 0,7. |
| regra de aceite | `decide` | Função pura: oferta, com hora resolvida, vagas diferentes de zero, duas paradas e confiança acima do limiar vira `Accept(RideDraft)`; senão `Rejected(reason)`. As vagas que a mensagem disse são presas em `RIDE_SEAT_CAP` (4, D-142) antes de entrar no rascunho. |
| padrões de ausência | `DEFAULT_SEATS`, `DEFAULT_PRICE`, `DEFAULT_PAYMENT` | Vagas 2, R$ 7,00, dinheiro e PIX, quando a oferta não diz (D-116). |
| teto de vagas da carona | `RIDE_SEAT_CAP` | 4, o mesmo teto de `rides` (`MAX_SEATS`, D-142), duplicado aqui porque um contexto só importa `shared` (D-075). O interpretador ainda lê até 8 como plausível (`parser_output.MAX_SEATS`); é `decide` quem prende no que a carona aceita. |
| rascunho de carona | `RideDraft` | O que `importing` entrega a `rides`: paradas resolvidas com as tarifas que casaram, partida, vagas (já presas em `RIDE_SEAT_CAP`), preço, pagamento. `RidesBridge` o traduz para os tipos daquele contexto e chama `ImportRide`. |
| carona importada | em `rides`: `RideOrigin` WhatsApp | A `RideOffer` criada a partir de uma candidata: da conta com o telefone do remetente, sem carro, ou de motorista externo (ADR-0015, D-127). |
| junção por partida | `ImportRide` | Mesmo motorista e mesma partida é a mesma carona: a candidata nova é aceita como `joined` (D-113). |
| redação | `redact_personal_data` | Em `shared/domain`: telefone, e-mail, CPF e placa viram `[…]` antes de o texto original chegar à carona (D-128). |
| lista de bloqueio | `BlockedSenders` | Telefone de quem pediu para sair. `BlockSender` apaga mensagens, candidatas e caronas dele; a varredura nunca mais o toma (D-119). |
| pedido de remoção | `RemovalRequest` | O que o motorista com carona importada manda pela página pública, sem conta (D-162, D-172): telefone, qualquer número válido (D-137), gravado em E.164; quando chegou; um texto opcional de até 500 caracteres, sem espaço nas pontas; e a decisão. Sozinho não remove nada. O texto só sai no comando, nunca na API. |
| decisão do pedido | `RemovalDecision` | Tipo-soma gravado: pendente `Pending`, aprovado `Approved(at)`, recusado `Refused(at)`. A primeira decisão fica: repetir a mesma não muda nada, e a oposta é recusada (`RemovalAlreadyDecidedError`). |
| aprovação | `ApproveRemoval`, `manage.py approve_removal <id>` | Bloqueia o telefone pelo `BlockSender`, que apaga mensagens, candidatas e caronas externas dele, e só depois grava `Approved`. Aprovar o que já foi aprovado não bloqueia de novo. |
| recusa | `RefuseRemoval`, `manage.py approve_removal <id> --refuse` | Grava `Refused`; nada é removido e o pedido fica registrado. |
| varredura | `run_extractor` | Tarefa asyncio no processo do worker, acordada pelo handler do extrator, ao subir e a cada minuto (D-112): `IngestMessages` (mensagem em candidata), `JudgeCandidates` (uma por vez), `PurgeImported` quando a poda é do worker. |
| poda | `PurgeImported` | Caso de uso (D-119): apaga as caronas de motorista externo que já saíram, com candidatas e mensagens; as candidatas sem carona julgadas há mais de 24h; as mensagens não tomadas há mais de 24h. O job do `pg_cron` é a mesma regra em SQL (`purge_statements`), provada igual por contrato no Postgres. |
| golden set | `tests/importing/golden/messages.jsonl` | 120 mensagens reais anonimizadas com a leitura esperada. `poe test-golden` mede um modelo contra o Ollama: acerto de tipo, acerto por campo e latência (D-120). As medições ficam em [parser-models.md](../parser-models.md). |
| inspeção | `manage.py candidates`, `source_messages`, `import_rides` | O que foi julgado e por quê, o que chegou, e uma varredura à mão (D-124). |
| reprocessamento | `ReopenJudged`, `import_rides --rejudge` | Devolve a pendente o que foi julgado desde um dia e tira do mural as caronas externas que criou, para serem lidas de novo; a de conta fica (D-130). |

## Invariantes

- Mensagem-fonte só existe para grupo observado, texto não vazio e remetente com telefone; de
  remetente bloqueado, é apagada na varredura.
- Uma mensagem-fonte pertence a no máximo uma candidata; tomada, nunca é reprocessada.
- Uma candidata aceita aponta para exatamente uma carona; a mesma carona pode ter várias
  candidatas do mesmo remetente e da mesma partida (`joined`).
- Só `Offer` vira carona, e só com horário resolvido e duas paradas. O julgamento que falha deixa a
  candidata para a próxima varredura, até `IMPORT_MAX_ATTEMPTS`; nunca cria carona pela metade.
- O modelo nunca escolhe lugar do catálogo, data absoluta nem a qual parada pertence uma tarifa;
  isso é código. Par de parada e valor que não nomeia nenhuma parada, nomeia mais de uma, cai na
  parada de saída ou traz valor que a mensagem não escreveu é descartado: preço errado na carona
  toda é pior do que carona sem tarifa. Com tarifas, o preço do rascunho é a menor delas (D-131).
- A importação nunca preenche as observações da carona: o texto original já diz o que foi dito
  (D-129). As tarifas não entram na confiança; os pesos de `Checks` seguem os de D-115.
- Telefone do remetente nunca sai por lista; só pela rota de contato de `rides` (D-031).
- Nada de motorista externo sobrevive à partida: carona, candidata e fontes somem juntas (D-119).
  Carona vinculada a conta é do dono e fica.
- Pedido de remoção nunca remove nada por si: só a aprovação por comando bloqueia o telefone. A
  primeira decisão fica, e o pedido nunca é apagado.

## Pedido de remoção

1. `POST /api/removal-requests`, sem sessão, recebe telefone e texto opcional. Todo pedido bem
   formado responde 202 igual, tenha o telefone caronas no mural ou não. Mais de 10 pedidos por dia
   do mesmo cliente respondem 429; mais de 3 pedidos por dia para o mesmo telefone caem em silêncio,
   sem gravar, para a resposta nunca dizer se o telefone está no mural.
2. O pedido fica pendente e não remove nada: a página é pública, e qualquer um poderia pedir a
   remoção de outro motorista.
3. `manage.py removal_requests` lista os pendentes com o telefone mascarado (`--reveal` mostra
   inteiro) e avisa quando o texto traz telefone, e-mail ou placa (D-128); `--all` inclui os
   decididos.
4. `manage.py approve_removal <id>` bloqueia o telefone e apaga o que veio dele (D-119), primeiro,
   e grava a aprovação depois; uma falha no meio deixa o pedido pendente, e aprovar de novo termina
   o serviço. `--refuse` recusa. Quem pediu não é avisado: não há canal de volta.

## Fora do passo 7

Atualização por mensagem posterior (D-118), reivindicação por conta criada depois (após OTP,
D-034), pedidos de passageiro como agregado (D-010), fila de revisão.
