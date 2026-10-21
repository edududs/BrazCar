# Contexto `push`

Web Push de um aparelho: guarda onde o serviço de push do navegador alcança cada aparelho de uma
conta e entrega a ele uma mensagem cifrada. Feito para sair do projeto: o núcleo (`domain/` e
`application/`) só importa a stdlib e o Pydantic, nem `shared` (D-181).

## Glossário

| No negócio | No código | O que é |
|---|---|---|
| aparelho, inscrição | `PushSubscription` | Um aparelho de uma conta: endereço de entrega, chaves, dono, criado em e último uso. |
| endereço de entrega | `endpoint` | URL que o serviço de push do navegador cria para o aparelho. Único: um endereço, uma conta. É segredo de entrega, nunca vai ao log. |
| chaves | `p256dh` e `auth` | Ponto público P-256 (65 bytes) e segredo de autenticação (16 bytes) do aparelho, com que a mensagem é cifrada. |
| serviço de push | `PUSH_SERVICES` | Os hosts aceitos num `endpoint`: FCM, Mozilla, Apple e Windows, o próprio host ou um subdomínio (D-181). |
| teto de aparelhos | `DEVICE_LIMIT` | 5 por conta; o sexto tira o de uso mais antigo. |
| mensagem | `PushMessage` | O que o service worker mostra: título, corpo, `tag` e `url` (um caminho do front). Nada além disso. |
| entrega | `Delivery` | Resultado de uma tentativa: `SENT` (o serviço aceitou) ou `GONE` (o serviço diz que a inscrição não existe mais, 404 ou 410). Qualquer outra falha é exceção. |
| entregador | `PushTransport` | A porta que leva uma mensagem a uma inscrição; o adaptador usa `pywebpush` (D-182). |
| ligar o aparelho | `SubscribeDevice` | Grava a inscrição por upsert no `endpoint` e aplica o teto. |
| desligar o aparelho | `UnsubscribeDevice` | Apaga a inscrição, só se for da própria conta. |
| avisar a conta | `PushToAccount` | Entrega a mensagem a todos os aparelhos da conta, em paralelo, e trata `GONE`. |
| esquecer os aparelhos | `ForgetDevices` | Apaga todas as inscrições de uma conta; ligado a `AccountErased` (D-184). |
| chave pública VAPID | `VAPID_PUBLIC_KEY` | A chave que o navegador recebe ao criar a inscrição (`applicationServerKey`), entregue pela rota `GET /api/push/public-key`. A API assina cada envio com a privada do mesmo par, e o serviço de push só aceita envio assinado por ela (D-183). |

## Por que é contexto próprio

Entregar uma mensagem a um aparelho não é regra de aviso nem de conta: serve a qualquer remetente.
Por isso o núcleo não importa `shared` e a inscrição não mora em `alerts`, o que a amarraria a um
remetente só. `alerts` usa o `push` pela ponte `DevicePushSender`, que adapta a porta `PushSender`
ao caso de uso `PushToAccount`. `accounts` não o conhece: `DeleteAccount` só chama a porta
`AccountErased`, e a raiz de composição a liga a `ForgetDevices` (D-184).

## Invariantes

- O `endpoint` só é aceito quando aponta para um serviço de push conhecido, por HTTPS e sem
  credenciais: a API é quem faz o POST para ele.
- Um `endpoint`, uma conta: o mesmo endereço vindo de outra conta passa para ela.
- Uma conta tem no máximo 5 aparelhos; ao chegar o sexto, sai o de uso mais antigo.
- Só o dono cancela a inscrição. Cancelar endereço alheio ou desconhecido responde como sucesso e
  não apaga nada.
- Resposta 404 ou 410 do serviço apaga a inscrição.
- A falha de um aparelho não impede a entrega aos outros da conta.
- O `endpoint` nunca vai ao log; registra-se o host do serviço e o status.
- Aparelho de conta excluída nunca é listado para envio.
- O payload leva só os quatro campos da mensagem.

## Na tela

O hook `useDevicePush` (D-185) é a única porta do front para o aparelho. A função pura
`devicePushView` reduz a permissão e a inscrição a seis situações (sem suporte, falta instalar,
bloqueado, verificando, ligado e desligado), e o primitivo `DevicePushControl` as desenha, com o
botão de ligar ou desligar, na folha "Me avise" e na conta (D-188). "Sair da conta" desliga o
aparelho antes de encerrar a sessão, porque cancelar na API exige a sessão aberta (D-189).

## Fora, de propósito

- Sem fila: a entrega corre dentro da requisição de quem gravou a carona, até 5 s por aparelho, em
  paralelo (D-177).
- TTL e urgência únicos (12 horas, alta) enquanto há um remetente só; passam para a mensagem quando
  outro pedir outros (D-182).
