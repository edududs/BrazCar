# 0010 — Revisão do mural com sinal por SSE

Status: decidido (2026-09-20). Cobre: D-046 a D-049.

## Contexto

O mural precisa refletir caronas novas sem recarregar, sem que a carga cresça com o número de usuários. Quem escreve está em mais de um processo, e signals do Django não cruzam processo. O banco é plugável, e todo tráfego passa pelo túnel do Cloudflare.

## Decisão

Uma linha no banco guarda a revisão do mural, incrementada na mesma transação de toda escrita. Uma porta de saída tem `publish` e `subscribe`. O primeiro adaptador é uma tarefa única no processo web que lê a revisão uma vez por segundo e envia por SSE apenas "mudou, revisão N". O front invalida a consulta, esperando até dois segundos aleatórios, e a lista fica em cache por revisão. Buscar ao focar a aba e ao voltar a rede é obrigatório.

## Alternativas descartadas

- **Refresh a cada 5 ou 10 segundos.** milhares de buscas por celular por dia, crescendo com os usuários.
- **`LISTEN/NOTIFY` como único mecanismo.** só existe no Postgres; fica como segundo adaptador.
- **Django Channels com WebSocket.** traz Redis de volta sem necessidade de canal bidirecional.
- **Enviar a carona dentro do sinal.** cada usuário tem filtros diferentes, e o canal passaria a carregar dados.
- **Motores de sincronização.** exigem replicação lógica do Postgres.

## Consequências

- Custo fixo de uma consulta por segundo, independente do número de usuários.
- Risco aberto: o Cloudflare pode fazer buffer de SSE. É a primeira coisa a testar, num iPhone. Plano B atrás da mesma porta: consulta condicional.
- No iOS a conexão morre em segundo plano parecendo viva: heartbeat, vigia e reconexão ao voltar ao foco.
