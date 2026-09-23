# Contexto `importing`

Transforma mensagens dos grupos de WhatsApp em caronas do mural. Só lê: nunca envia nada (D-041).
Depende do extrator embutido (ADR-0009) e entrega para `rides` por porta (ADR-0015).

## Glossário

| No negócio | No código | O que é |
|---|---|---|
| conta pareada | `account` | O número de WhatsApp que o worker lê. Um processo por conta (D-043); a sessão fica no banco. |
| grupo observado | `WatchedGroup` | JID de grupo e rótulo, da variável de ambiente `WHATSAPP_GROUPS` (D-109). Só o que está na lista é gravado; o rótulo é o que a interface mostra. |
| mensagem-fonte | `SourceMessage` | Mensagem de texto de um grupo observado, gravada pelo `DjangoStore` (D-111): conta, id da mensagem, JID do grupo, remetente, enviada em, texto, recebida em. Única por (conta, id). |
| remetente | `Sender` | Telefone e nome de exibição de quem postou. O telefone é a identidade do motorista externo. |
| chave de texto | `TextKey` | O texto sem acento, sem caixa, sem emoji nem pontuação, com espaços colapsados. Duas mensagens com a mesma chave são a mesma postagem. |
| janela de junção | `DEDUP_WINDOW` | 6 horas. Mensagem com o mesmo remetente e a mesma chave dentro da janela entra na candidata existente; fora dela abre outra. |
| candidata | `Candidate` | Uma postagem, com uma ou mais mensagens-fonte (a mesma carona em quatro grupos é uma candidata com quatro fontes). Raiz do agregado. |
| veredito | `Verdict` | Tipo-soma: pendente `Pending`, aceita `Accepted(ride_id)`, rejeitada `Rejected(reason)`, falhou `Failed(error, attempts)`. Só a aceita tem carona. |
| interpretador | `RideParser` | Porta: texto e contexto (enviada em, rótulo do grupo) entram, julgamento tipado sai. Adaptador Ollama em produção, fake nos testes (D-115). |
| saída do interpretador | `ParserOutput` | O tipo plano que vira JSON schema para o modelo: `kind`, e campos opcionais de oferta. Nunca chega ao domínio sem virar julgamento. |
| julgamento | `Judgement` | Tipo-soma do que a mensagem é: oferta `Offer`, pedido `Request`, atualização `Update`, outro `Other`. Só a oferta vira carona (D-009). |
| oferta interpretada | `Offer` | Horário relativo (`time`, `day`), paradas como texto em ordem, vagas, preço, formas de pagamento, tudo opcional menos as paradas. |
| resolução de parada | `StopResolver` | Porta para `places`: texto de parada vira `CatalogStop` quando casa com nome ou apelido; senão `FreeTextStop`. O modelo nunca escolhe identificador. |
| resolução de horário | `resolve_departure` | Função pura: enviada em, `day` e `time` viram `departure_at` no fuso do mural. Horário já passado sem "hoje" cai no dia seguinte (a oferta da manhã é postada na noite anterior). |
| conferências | `Checks` | Conjunto de verificações determinísticas ancoradas no texto: vagas aparecem, horário aparece, preço aparece, cada parada aparece, quantas casaram no catálogo. Gravadas com a candidata. |
| confiança | `Confidence` | Número de 0 a 1 calculado das conferências, nunca declarado pelo modelo. |
| limiar de aceite | `IMPORT_ACCEPT_THRESHOLD` | Abaixo dele a oferta é rejeitada com motivo (D-116). |
| padrões de ausência | `DEFAULT_SEATS`, `DEFAULT_PRICE`, `DEFAULT_PAYMENT` | Vagas 2, R$ 7,00, dinheiro e PIX, quando a oferta não diz (D-116). |
| rascunho de carona | `RideDraft` | O que `importing` entrega a `rides`: motorista externo, origem WhatsApp, rota resolvida, partida, vagas, preço, pagamento. |
| carona importada | em `rides`: `ExternalDriver`, `WhatsAppOrigin` | A `RideOffer` criada a partir de uma candidata (ADR-0015). Sem dono com conta; expira só pelo horário. |
| junção por partida | `same_departure` | Mesmo remetente e mesma partida no mesmo minuto é a mesma carona: a candidata nova se anexa à existente (D-113). |
| lista de bloqueio | `BlockedSender` | Telefone de quem pediu para sair. Mensagens, candidatas e caronas dele são apagadas e nada novo dele é gravado (D-119). |
| poda | `Purge` | Porta: apaga carona importada, candidata e mensagens-fonte quando a carona vira "já saiu", e mensagem sem carona 24h após o julgamento. Adaptadores `pg_cron` e varredura no worker (D-119). |
| consumidor | `run_extractor` | Tarefa asyncio no processo do worker, acordada pelo handler do extrator, com varredura ao subir e a cada minuto; uma candidata por vez (D-112). |
| golden set | `tests/importing/golden/` | Mensagens reais anonimizadas com o julgamento esperado. Portão pesado contra o Ollama (D-120). |

## Invariantes

- Mensagem-fonte só existe para grupo observado, texto não vazio e remetente não bloqueado.
- Uma mensagem-fonte pertence a no máximo uma candidata; marcada, nunca é reprocessada.
- Uma candidata aceita aponta para exatamente uma carona; uma carona importada vem de uma ou mais
  candidatas do mesmo remetente e da mesma partida.
- Só `Offer` vira carona, e só com horário resolvido e duas paradas. Sem regra, sem carona: o
  julgamento que falha deixa a candidata pendente ou falha, nunca cria carona pela metade.
- O modelo nunca escolhe lugar do catálogo nem data absoluta; isso é código.
- Telefone do remetente nunca sai por lista; só pela rota de contato de `rides` (D-031).
- Nada importado sobrevive à partida: carona, candidata e fontes somem juntas (D-119).

## Fora do passo 7

Atualização por mensagem posterior (D-118), reivindicação da carona pelo motorista (após OTP, D-034),
pedidos de passageiro como agregado (D-010), fila de revisão.
