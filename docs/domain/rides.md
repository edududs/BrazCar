# Contexto `rides`

## Glossário

| No negócio | No código | O que é |
|---|---|---|
| carona | `RideOffer` | Oferta de um motorista para uma viagem específica. Raiz do agregado. |
| rota | `Route` | Sequência ordenada de paradas. Nunca um par origem e destino. |
| parada | `Stop` | Um ponto da rota: referência a um lugar do catálogo, ou texto livre ("outro"). |
| vagas | `seats_available` | Vagas restantes, ajustadas à mão pelo motorista. |
| horário de partida | `departure_at` | Horário atual, com fuso. |
| horário original | `original_departure_at` | Gravado na publicação, nunca muda. Base da regra de atraso. |
| situação | `RideStatus` | Calculada, nunca gravada. |
| reaberta | `reopened_at` | Data do último reabrir. É transição, não situação gravada. |
| preço | `price` | `Decimal`, único por carona, padrão R$ 7,00. |
| forma de pagamento | `PaymentMethod` | Conjunto fechado: dinheiro, PIX. |
| carro na carona | `CarSnapshot` | Cópia de modelo, cor e placa no momento da publicação. |
| repetir carona | `RepeatRide` | Caso de uso que cria uma carona nova a partir de outra. |
| pedido de contato | `ContactRequest` | Registro de quem pediu o contato de qual carona. Tabela própria. |
| histórico | `RideEvent` | Tabela só de acréscimo com os eventos do agregado. |

Eventos: `RidePublished`, `SeatsChanged`, `RideEdited`, `RideReopened`, `RideCancelled`.

## Situação

Função pura de quatro dados, lida nesta ordem:

1. `cancelled_at` preenchido: **cancelada**.
2. Agora passou de `departure_at` mais a tolerância (cerca de 20 minutos, configurável): **já saiu**.
3. `seats_available` igual a zero: **fechada**.
4. `reopened_at` preenchido: **reaberta**. Senão: **aberta**.

## Invariantes

- Carona aberta tem pelo menos uma vaga. Zerar as vagas fecha. Aumentar as vagas de uma carona
  fechada reabre e grava `reopened_at`. Fechar e "lotou" são o mesmo gesto.
- Cancelada é definitiva. Quem muda de ideia usa repetir.
- Publicar exige um carro cadastrado na conta.
- Rota tem pelo menos duas paradas, em ordem.

## Edição

- Permitida em carona aberta ou fechada. Nunca em cancelada.
- Antes da partida: edição livre, mas o horário só muda dentro do mesmo dia. Outro dia é outra carona.
- Depois da partida: só adiar, e o novo horário não passa de duas horas depois do
  `original_departure_at`. O limite conta sempre do original, para não encadear atrasos.
- Passadas as duas horas do original, a carona trava. Sobra cancelar ou repetir.

## Privacidade

O read-model do mural traz nome social, modelo e cor do carro. Telefone e placa só saem pela
rota de contato, que exige login, tem limite por conta e grava um `ContactRequest`.

## Fora do MVP

Pedido de carona por passageiro, recorrência, preço por trecho, reserva de vaga, avaliação.
