# Contexto `feedback`

## Glossário

| No negócio | No código | O que é |
|---|---|---|
| opinião | `Feedback` | O que uma pessoa com conta disse sobre o app, do jeito que escreveu. |
| tipo | `FeedbackKind` | Sugestão (`suggestion`), reclamação (`complaint`) ou elogio (`praise`). |
| mensagem | `message` | Texto puro, de 1 a 1000 caracteres (`MESSAGE_LIMIT`), sem espaço sobrando nas pontas. |
| sobre quem | `about_phone` | O celular de quem uma reclamação aponta, em E.164 (`PhoneNumber`, D-135). Opcional. |
| versão do front | `web_version` | A versão que a pessoa usava ao enviar. Ajuda a separar um defeito de um front velho. |
| caixa de opiniões | `FeedbackBox` | A porta: guarda uma opinião e lista as enviadas a partir de um momento. |

## Por que é contexto próprio

A opinião é sobre o app, não sobre uma carona. Não muda o mural, não depende de lugar, e quem lê
é a equipe, não outro usuário. Nenhum outro contexto precisa dela, e ela só precisa de `shared`:
o `PhoneNumber`, o `RateLimiter` e o `Clock`.

## Invariantes

- Só quem tem conta envia. A opinião guarda a conta que a enviou, e excluir a conta a deixa
  anônima no lugar (D-090).
- Só a reclamação aponta alguém. Sugestão e elogio com celular são recusados.
- O celular apontado é guardado como foi digitado, depois de validado. Nunca é resolvido para uma
  conta: não existe ligação entre a opinião e a conta de quem ela aponta.
- O texto é guardado como foi escrito. O detector de dado pessoal (D-128) não redige a opinião;
  só o comando de leitura avisa quando o texto traz telefone, e-mail ou placa.
- Cada conta tem um limite de opiniões por janela (`FEEDBACK_LIMIT` a cada
  `FEEDBACK_WINDOW_HOURS`). Um formulário com erro não gasta o limite.

## Leitura

Nada mostra as opiniões no app: nem a quem enviou, nem no mural, nem a quem uma reclamação aponta.
A leitura é pelo comando `manage.py feedback --since HORAS` (padrão, uma semana), que mascara o
celular apontado (`+5561*****0002`) e só o mostra inteiro com `--reveal`.

## Fora, de propósito

Sem anexo, sem resposta à pessoa, sem avaliação de usuário, sem aviso a quem uma reclamação aponta.
Os motivos estão em D-155.
