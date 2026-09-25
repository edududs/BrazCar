# Contexto `rides`

## Glossário

| No negócio | No código | O que é |
|---|---|---|
| carona | `RideOffer` | Oferta de um motorista para uma viagem específica. Raiz do agregado. |
| motorista | `Driver` | Tipo-soma: `RegisteredDriver` (conta e carro; o carro pode faltar só numa carona importada, D-127) ou `ExternalDriver` (telefone e nome do WhatsApp, sem conta; ADR-0015). O telefone é o `PhoneNumber` de `shared` (D-135): qualquer número válido, fixo ou de fora (D-137). |
| origem | `RideOrigin` | Tipo-soma: `PublishedOrigin` (publicada aqui) ou `WhatsAppOrigin` (texto original já redigido, rótulo do grupo, enviada em; D-117, D-128). |
| carona importada | `is_imported` | Carona com origem WhatsApp. Sem ação de dono quando o motorista é externo; apagada pela poda quando parte (D-119). |
| rota | `Route` | Sequência ordenada de paradas. Nunca um par origem e destino. |
| parada | `Stop` | Um ponto da rota: `CatalogStop` (referência a um lugar do catálogo, por identificador) ou `FreeTextStop` (texto livre, "outro"). |
| tarifa | `Stop.fare` | Opcional: quanto custa ir da origem até aquela parada (D-131). A parada de onde a carona sai nunca tem. |
| observações | `notes` | Texto livre opcional do motorista, até 500 caracteres, sem formatação (D-129). Recusa telefone, e-mail e placa; nunca vem de importação. |
| vagas | `seats_available` | Vagas restantes, ajustadas à mão pelo motorista. |
| horário de partida | `departure_at` | Horário atual, com fuso. |
| horário original | `original_departure_at` | Gravado na publicação, nunca muda. Base da regra de atraso. |
| situação | `RideStatus` | Calculada, nunca gravada: aberta `open`, reaberta `reopened`, lotada `full`, já saiu `departed`, cancelada `cancelled`. |
| reaberta | `reopened_at` | Data do último reabrir. É transição, não situação gravada. |
| preço | `price` | `Decimal`, único por carona, padrão R$ 7,00. Com tarifas na rota é a menor delas, calculado por `price_from`, e deixa de ser digitado (D-131). |
| tem tarifa | `has_fares` | Alguma parada diz o próprio preço, então o preço da carona é um "a partir de". O read model entrega pronto; a tela só desenha. |
| forma de pagamento | `PaymentMethod` | Conjunto fechado: dinheiro `cash`, PIX `pix`. |
| carro na carona | `CarSnapshot` | Cópia de modelo, cor e placa no momento da publicação. |
| repetir carona | `RepeatRide` | Caso de uso que cria uma carona nova a partir de outra. |
| importar carona | `ImportRide` | Caso de uso chamado por `importing`: acha a conta pelo telefone do remetente ou cria motorista externo, junta repostagem da mesma partida (D-113), grava e indexa. |
| esquecer caronas | `ForgetRides` | Apaga caronas de motorista externo, para a poda (D-119). Nunca as de conta. |
| ações permitidas | `Actions` | O que quem vê pode fazer com a carona, calculado no servidor: editar, mudar vagas, cancelar, repetir, pedir contato e até quando pode adiar. |
| card do mural | `BoardRide` | O que a lista mostra: nome, carro (modelo e cor, quando há), origem, mensagem original (quando importada), paradas com nome e tarifa, observações, situação e ações. Nunca telefone nem placa. |
| filtros do mural | `BoardFilter` | A partir de qual hora local (`from_time`, D-141), dia, "passa por" em texto livre, só com vaga, preço máximo. Vivem na URL do front. |
| busca de caronas | `RideSearch` | Acha caronas pelo texto das paradas: nome, apelidos e lugares acima de cada parada do catálogo, e o texto das paradas "outro" (D-101). Observações ficam de fora do índice. |
| pedido de contato | `ContactRequest` | Registro de quem pediu o contato de qual carona, com o número revelado, o tipo de motorista e o momento (D-140). Tabela própria, sobrevive à carona. |
| histórico | `RideEvent` | Tabela só de acréscimo com os eventos do agregado. |
| revisão do mural | `BoardRevision` | Contador único, em `shared`, incrementado por toda escrita que muda o mural. |
| sinal do mural | `BoardSignal` | Porta de saída "mudou, revisão N"; o adaptador lê a revisão uma vez por segundo e serve por SSE. |
| limite de pedidos | `RateLimiter` | Porta de `shared` que conta tentativas por chave numa janela; contato, login e recuperação de senha passam por ela. |

Eventos: `RidePublished`, `SeatsChanged`, `RideEdited`, `RideReopened`, `RideCancelled`.

## Situação

Função pura de quatro dados, lida nesta ordem:

1. `cancelled_at` preenchido: **cancelada**.
2. Agora passou de `departure_at` mais a tolerância (10 minutos por padrão, configurável; D-121): **já saiu**.
3. `seats_available` igual a zero: **lotada** (fechada).
4. `reopened_at` preenchido: **reaberta**. Senão: **aberta**.

## Invariantes

- Carona aberta tem pelo menos uma vaga. Zerar as vagas fecha. Aumentar as vagas de uma carona
  fechada reabre e grava `reopened_at`. Fechar e "lotou" são o mesmo gesto.
- Cancelada é definitiva. Quem muda de ideia usa repetir.
- Publicar exige um carro cadastrado na conta, e a carona nova nasce com pelo menos uma vaga.
  Só uma carona importada pode vir sem carro (conta achada pelo telefone) ou sem conta (motorista
  externo); a importada nunca vem de origem publicada.
- Motorista externo não é dono de nada: ninguém edita, muda vagas, cancela ou repete a carona dele.
- Rota tem pelo menos duas paradas, em ordem: a primeira é de onde sai, a última para onde vai, e
  entre elas as paradas no caminho, opcionais. Parada do catálogo aponta para um lugar que existe.
- Tarifa é o preço de chegar até a parada, contado da origem, então a primeira parada nunca tem
  uma (`FareOnOriginError`). Não há ordem exigida entre tarifas: só precisam ser positivas.
- Havendo tarifa em alguma parada, o preço da carona é a menor delas e o preço digitado é ignorado;
  sem nenhuma, o preço é o que o motorista digitou. Publicar, editar e repetir passam por
  `price_from`, e a entidade recusa uma carona em que os dois discordem.
- Observações são texto simples de até 500 caracteres. Sequência que pareça telefone, e-mail ou
  placa é recusada (`PersonalDataError`), nunca redigida: quem publica é dono das palavras e
  corrige. O detector é o mesmo da importação, em `shared/domain/personal_data.py` (D-128, D-129).
  Editar com texto vazio apaga as observações; carona importada nunca tem observações.
- Datas voltam do banco no fuso do mural (`America/Sao_Paulo`): "mesmo dia" e o filtro por dia
  leem a data local, nunca a UTC.

## Edição

- Permitida em carona aberta ou fechada. Nunca em cancelada.
- Antes da partida: edição livre, mas o horário só muda dentro do mesmo dia. Outro dia é outra carona.
- Depois da partida: só adiar, e o novo horário não passa de duas horas depois do
  `original_departure_at`. O limite conta sempre do original, para não encadear atrasos.
- Passadas as duas horas do original, a carona trava. Sobra cancelar ou repetir.

## Privacidade e contato

O read-model do mural traz nome social, modelo e cor do carro. Telefone e placa só saem pela
rota de contato, que exige login, tem limite por conta e grava um `ContactRequest`. Só carona
aberta ou reaberta aceita pedido de contato; o motorista nunca vê o botão na própria carona.
Na carona importada o contato vai ao telefone do remetente (ou da conta achada por ele) e volta
sem placa; o texto original que o detalhe mostra já passou pela redação de dados pessoais (D-128).

O `ContactRequest` guarda o número revelado, se o motorista é `registered` ou `external` e a conta
dele quando tem uma (D-140). Sobrevive à carona: `ForgetRides` apaga a carona importada ao partir
(D-119), mas o pedido de contato fica, com a referência à carona nula. `manage.py contact_requests`
consulta por conta ou pelo número revelado, numa janela de horas.

## Fora do MVP

Pedido de carona por passageiro, recorrência, preço conforme o ponto de embarque (D-131), reserva
de vaga, avaliação.
