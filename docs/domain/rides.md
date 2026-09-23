# Contexto `rides`

## Glossário

| No negócio | No código | O que é |
|---|---|---|
| carona | `RideOffer` | Oferta de um motorista para uma viagem específica. Raiz do agregado. |
| rota | `Route` | Sequência ordenada de paradas. Nunca um par origem e destino. |
| parada | `Stop` | Um ponto da rota: `CatalogStop` (referência a um lugar do catálogo, por identificador) ou `FreeTextStop` (texto livre, "outro"). |
| vagas | `seats_available` | Vagas restantes, ajustadas à mão pelo motorista. |
| horário de partida | `departure_at` | Horário atual, com fuso. |
| horário original | `original_departure_at` | Gravado na publicação, nunca muda. Base da regra de atraso. |
| situação | `RideStatus` | Calculada, nunca gravada: aberta `open`, reaberta `reopened`, lotada `full`, já saiu `departed`, cancelada `cancelled`. |
| reaberta | `reopened_at` | Data do último reabrir. É transição, não situação gravada. |
| preço | `price` | `Decimal`, único por carona, padrão R$ 7,00. |
| forma de pagamento | `PaymentMethod` | Conjunto fechado: dinheiro `cash`, PIX `pix`. |
| carro na carona | `CarSnapshot` | Cópia de modelo, cor e placa no momento da publicação. |
| repetir carona | `RepeatRide` | Caso de uso que cria uma carona nova a partir de outra. |
| ações permitidas | `Actions` | O que quem vê pode fazer com a carona, calculado no servidor: editar, mudar vagas, cancelar, repetir, pedir contato e até quando pode adiar. |
| card do mural | `BoardRide` | O que a lista mostra: nome social, modelo e cor do carro, paradas com nome, situação e ações. Nunca telefone nem placa. |
| filtros do mural | `BoardFilter` | Dia, "passa por" em texto livre, só com vaga, preço máximo. Vivem na URL do front. |
| busca de caronas | `RideSearch` | Acha caronas pelo texto das paradas: nome, apelidos e lugares acima de cada parada do catálogo, e o texto das paradas "outro" (D-101). |
| pedido de contato | `ContactRequest` | Registro de quem pediu o contato de qual carona. Tabela própria. |
| histórico | `RideEvent` | Tabela só de acréscimo com os eventos do agregado. |
| revisão do mural | `BoardRevision` | Contador único, em `shared`, incrementado por toda escrita que muda o mural. |
| sinal do mural | `BoardSignal` | Porta de saída "mudou, revisão N"; o adaptador lê a revisão uma vez por segundo e serve por SSE. |
| limite de pedidos | `RateLimiter` | Porta de `shared` que conta tentativas por chave numa janela; contato, login e recuperação de senha passam por ela. |

Eventos: `RidePublished`, `SeatsChanged`, `RideEdited`, `RideReopened`, `RideCancelled`.

## Situação

Função pura de quatro dados, lida nesta ordem:

1. `cancelled_at` preenchido: **cancelada**.
2. Agora passou de `departure_at` mais a tolerância (cerca de 20 minutos, configurável): **já saiu**.
3. `seats_available` igual a zero: **lotada** (fechada).
4. `reopened_at` preenchido: **reaberta**. Senão: **aberta**.

## Invariantes

- Carona aberta tem pelo menos uma vaga. Zerar as vagas fecha. Aumentar as vagas de uma carona
  fechada reabre e grava `reopened_at`. Fechar e "lotou" são o mesmo gesto.
- Cancelada é definitiva. Quem muda de ideia usa repetir.
- Publicar exige um carro cadastrado na conta, e a carona nova nasce com pelo menos uma vaga.
- Rota tem pelo menos duas paradas, em ordem: a primeira é de onde sai, a última para onde vai, e
  entre elas as paradas no caminho, opcionais. Parada do catálogo aponta para um lugar que existe.
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

## Fora do MVP

Pedido de carona por passageiro, recorrência, preço por trecho, reserva de vaga, avaliação.
