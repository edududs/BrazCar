# Contexto `alerts`

"Me avise" na interface. A pessoa com conta guarda um filtro do mural com validade de um dia, e o
aparelho dela recebe uma notificação quando uma carona com vaga que casa com ele entra no mural,
publicada ou importada.

## Glossário

| No negócio | No código | O que é |
|---|---|---|
| aviso | `RideAlert` | O pedido "me avise": dono, "passa por", dia e janela de horário. Raiz do agregado. |
| passa por | `text` | Texto livre opcional, até 80 caracteres (`TEXT_LIMIT`), com a mesma semântica do `q` do mural (D-101). Em branco vale como ausente. |
| dia | `day` | Obrigatório. Nunca antes de hoje no fuso do mural (D-094); o próprio dia de hoje vale. |
| a partir de | `from_time` | Hora local opcional: partida nessa hora ou depois (D-141). |
| até | `until_time` | Hora local opcional: partida nessa hora ou antes, inclusiva no minuto (D-176). Com as duas, não vem antes de `from_time`. |
| ativo | `is_active` | Calculado, nunca gravado: o dia de hoje, no fuso do mural, não passou do `day` (D-179). |
| teto | `AlertRules.limit` | Quantos avisos ativos uma conta tem ao mesmo tempo: 5 (`ALERT_ACTIVE_LIMIT`, D-175). |
| notificação | `Notice` | O que vai ao aparelho: título, corpo com paradas e horário, `tag` com o id do aviso e `url` do detalhe. Nunca dado de pessoa (D-178). |
| registro de notificações | `NoticeLog` | A porta que reivindica o par (aviso, carona) antes do envio: verdadeira só na primeira vez (D-178). |
| remetente | `PushSender` | A porta que entrega uma notificação a todos os aparelhos de uma conta. A entrega real vai por `DevicePushSender` ao contexto [`push`](push.md); com o push desligado, o `LoggingPushSender` só registra no log (D-182). |
| mural, para o aviso | `BoardRides` | A porta pela qual `alerts` pergunta a `rides` o resumo anônimo de uma carona e se o mural, filtrado como o aviso pede e só com vaga, a mostraria agora (D-176). |
| resumo da carona | `RideSummary` | Paradas (rótulos) e horário de uma carona, lidos da visão anônima do detalhe (D-171). |
| avisar | `NotifyMatchingAlerts` | Caso de uso que ouve `RideChanged` (D-177): para cada aviso ativo do dia da carona, pergunta ao mural, reivindica o par e envia. |
| limpeza | `PurgeAlerts` | Apaga os avisos de dias anteriores a hoje, com as notificações deles; `manage.py purge_alerts` (D-179). |

## Por que é contexto próprio

O aviso não muda o mural nem a carona: é um pedido de uma pessoa sobre caronas que ainda não
existem. `rides` não sabe que avisos existem; só chama a porta `RideChanged` depois de gravar
(D-177). `alerts` sabe de `rides` só pelo identificador da carona e pela porta `BoardRides`, cujo
adaptador usa os casos de uso `ShownOnBoard` e `ShowRide`. A regra de casamento continua sendo a do
mural, num lugar só (D-176).

## Invariantes

- Só quem tem conta cria, lista e apaga aviso; criar e apagar passam pelo portão de escrita (D-168).
- O dia nunca é anterior a hoje no fuso do mural. Uma janela com `until_time` antes de `from_time`
  é recusada.
- Uma conta tem no máximo 5 avisos ativos; aviso vencido não conta.
- Um aviso casa com uma carona quando o mural, com `day`, `text`, `from_time` e `until_time` do
  aviso e `with_seats` ligado, mostraria essa carona naquele momento. Só a carona gravada depois do
  aviso avisa.
- Um par (aviso, carona) gera no máximo uma notificação, mesmo com a carona editada depois; o par é
  reivindicado antes do envio, então uma entrega que falha não se repete.
- A notificação leva só a primeira e a última parada, o dia relativo ("hoje", "amanhã" ou `dd/mm`)
  e a hora, no fuso do mural, mais o id do aviso e o caminho do detalhe.
- Falha em `alerts` nunca falha a carona: `rides` captura e registra no log o erro de quem ouve.
- Aviso de conta excluída não dispara nem aparece, e a limpeza o apaga.

## Fora, de propósito

Sem recorrência, sem aviso de carona que já estava no mural e sem fila de envio. A inscrição do
aparelho e o Web Push moram em `push` ([push.md](push.md)); a tela do "Me avise" é a etapa seguinte.
