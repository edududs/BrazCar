# Contexto `accounts`

## Glossário

| No negócio | No código | O que é |
|---|---|---|
| conta | `Account` | Agregado: a conta e seus carros. Uma conta só serve a passageiro e a motorista. |
| identificador | `AccountId` | UUID gerado no domínio; a linha do usuário do Django usa o mesmo (D-090). |
| telefone | `PhoneNumber` | Value object de `shared` (D-135), gravado em E.164 (D-089). Identificador de login e destino do link `wa.me`. |
| telefone de conta | `AccountPhone`, `account_phone` | A regra deste contexto sobre o `PhoneNumber`: só celular do Brasil (D-137). Fixo é `NotAMobilePhoneError`, número de fora é `ForeignPhoneNumberError`. |
| nome social | `display_name` | Obrigatório. É o único nome exibido no mural, e o cadastro avisa isso. |
| e-mail | `email` | Único por conta, sem distinguir maiúsculas. Toda conta nova tem, confirmado; conta de antes do convite pode não ter. Recupera a senha. |
| e-mail confirmado | `email_confirmed_at`, `email_confirmed` | Quando se provou que o e-mail chega à pessoa. Só existe com e-mail. O e-mail só muda por link, que já o grava confirmado (`Account.confirm_email`). |
| ação exigida | `required_action`, `RequiredAction` | Calculada, nunca gravada: o que a conta precisa fazer antes de escrever qualquer outra coisa. Hoje só `confirm_email`, para conta sem e-mail confirmado; `null` quando não falta nada (D-168). |
| conta retida | `WriteGate`, `AccountWriteGate`, `writer_auth` | Conta com ação exigida: entra e lê, mas toda escrita responde 403 com a ação no corpo, até ela ser cumprida (D-168). |
| telefone verificado | `phone_verified_at` | Previsto no modelo, sem uso no MVP. |
| carro | `Car` | Modelo, cor e placa. Uma conta pode ter vários. |
| placa | `LicensePlate` | Value object. Aceita o formato antigo e o Mercosul, normaliza para maiúsculas sem hífen. |
| pode dirigir | `can_drive` | Derivado: a conta tem pelo menos um carro. É o que `rides` lê para permitir publicar. |
| exclusão de conta | `DeleteAccount` | Caso de uso que apaga a conta no lugar (`erase`): dados pessoais somem, o identificador fica para o histórico. |
| credenciais | `Credentials` | Porta: guarda e confere a senha. O domínio nunca a vê. |
| aceite dos termos | `terms_accepted_at` | Quando a pessoa aceitou os termos no cadastro (D-033). |
| editar dados pessoais | `Account.update_profile`, `UpdateProfile` | Nome social, o único campo que a própria conta edita livremente (D-139, D-168). |
| trocar o e-mail | `RequestEmailChange`, `ConfirmEmail` | Pedir o link para o endereço novo e abri-lo com a sessão da conta. O e-mail antigo vale até a confirmação (D-168). |
| link de troca de e-mail | `EmailConfirmation`, `EmailConfirmationTokens` | O que o link carrega (conta, e-mail novo, prazo de 2 horas e a confirmação que a conta tinha ao pedir) e a porta que o assina e lê, sem guardar nada no banco. Morre na primeira confirmação posterior. |
| trocar a senha | `ChangePassword` | Exige a senha atual, verificada pela porta `Credentials`; sem ela, não muda nada (D-139). |
| convite | `Invite`, `IssueInvite` | Agregado: acesso de uso único, com prazo, que o dono emite para um telefone. Substitui o cadastro aberto (D-159, D-166). |
| token do convite | `invite_digest` | O segredo que vai no link do convite. Só o resumo sha256 é guardado (`token_digest`). |
| e-mail informado | `EmailGiven` | O convite já tem o e-mail que a pessoa digitou e o resumo do token do link de confirmação. |
| abrir o convite | `OpenInvite` | O que a página do link do convite mostra: situação, telefone e prazo, e o e-mail que espera confirmação. |
| informar o e-mail | `GiveInviteEmail` | O passo do e-mail: grava o e-mail no convite e manda para ele o link de confirmação. Limite de 5 envios por convite em 4 horas. |
| link de confirmação | `email_digest`, `email_expires_at` | O link mandado ao e-mail informado. Vale 2 horas a partir do envio e é o que abre o cadastro (`OpenSignup`). |
| cadastro por convite | `RegisterFromInvite`, `Account.register_from_invite` | O único cadastro: pelo link de confirmação, com nome social, senha e termos. Telefone e e-mail vêm do convite, e a conta nasce com o e-mail confirmado. Consome o convite. |
| situação do convite | `InviteStatus` | Calculada, nunca gravada: aberto `open`, aguardando confirmação `awaiting_email_confirmation`, usado `consumed`, vencido `expired`, invalidado `superseded`. |

## Invariantes

- Telefone é único por conta.
- E-mail é único por conta, sem distinguir maiúsculas.
- Telefone de conta é celular do Brasil. A conta e o contato o mostram como `(61) 99999-9999`.
- Ver o mural não exige conta. Qualquer interação exige: publicar, pedir contato, editar.
- Conta sem e-mail confirmado não escreve até confirmar um (D-168).
- Publicar carona exige pelo menos um carro. Uma placa aparece uma vez por conta.
- A marca do carro não é guardada: o modelo já a traz ("Gol prata", "BYD cinza").
- CPF, CNH e documentos ficam fora.

## Encaixe com o Django

`Account` é do domínio. O usuário customizado do Django, com o telefone como identificador,
existe desde a primeira migration e mora no adaptador, que reaproveita o hash de senha e a sessão
do framework. O domínio não conhece `User`.

## Convite

O cadastro aberto sai (D-159). O dono emite um convite para um telefone e manda o link por
mensagem direta a esse número. A pessoa abre o link e digita o e-mail; o convite guarda o e-mail e
manda para ele o link de confirmação. Esse link abre o resto do cadastro, e a conta nasce com o
e-mail já confirmado (D-160). Não há cadastro pendente nem senha guardada antes da hora: até o fim,
o que existe é o convite, emitido, com e-mail informado ou consumido.

- Telefone que já tem conta não recebe convite. Um convite vira uma conta só.
- Só o convite mais recente de um telefone vale. Os anteriores ficam invalidados por cálculo, sem
  escrita neles (ADR-0008).
- Token nenhum é guardado, só o resumo. Redigitar o e-mail troca o token do link de confirmação, e
  o anterior deixa de valer.
- O prazo do convite (4 horas) vale até o e-mail ser informado; dali em diante vale só o do link de
  confirmação (2 horas a partir do envio), mesmo que passe do convite. Se o link vence com o convite
  ainda no prazo, a situação volta a aberto e a pessoa pode informar o e-mail de novo.
- Consumido é final. Toda mudança incrementa a versão, e o repositório só grava sobre a versão
  anterior: de dois consumos simultâneos, um perde com `InviteConflictError`.
- Telefone que ganhou conta por outro caminho encerra o convite, como se tivesse sido usado: a
  página do convite, o passo do e-mail e o cadastro respondem "este telefone já tem conta".

### Passo do e-mail

`GET /api/accounts/invites/{token}` abre o convite e mostra o telefone mascarado e o prazo; se já
há e-mail esperando confirmação, mostra também o e-mail mascarado, para a pessoa poder redigitar.
`POST /api/accounts/invites/{token}/email` grava o e-mail no convite e manda o link de confirmação,
em português, dizendo que ele vale 2 horas e que quem não pediu pode ignorar. Convite substituído
não manda nada. E-mail que já tem conta é recusado, e o envio passa pelo limite de 5 por convite
em 4 horas (`InviteLimits`), para o convite não virar disparador de e-mail a terceiros.

### Cadastro

`GET /api/accounts/signup/{token}` abre o link de confirmação e mostra o telefone mascarado e o
e-mail, os dois travados. `POST /api/accounts/register` recebe o token do link, o nome social, a
senha e o aceite dos termos, cria a conta com `email_confirmed_at` preenchido e já inicia a sessão.
Não há cadastro aberto: telefone e e-mail nunca vêm no corpo.

A conta, a senha e o convite são três gravações sem unit of work (ADR-0008), nesta ordem: a conta,
cujo telefone único é a primeira trava; a senha; e o convite consumido sobre a versão, a segunda
trava. Parar no meio não faz estrago: com o telefone já dono de uma conta o convite não serve mais,
e a conta tem o e-mail confirmado, que recupera a senha.

Conta de antes do convite que tinha e-mail foi marcada como confirmada pela migração; a que não
tinha segue sem e-mail.

## Edição de dados pessoais

`PATCH /api/accounts/me` edita só o nome social: ausente no corpo, não muda; enviado, segue a
mesma regra do cadastro (não pode ficar vazio). O e-mail saiu daqui (D-168): muda só pelo link da
seção seguinte, e e-mail em branco não limpa mais nada. O telefone não está aqui: ele é a identidade da conta e a
verificação de posse ainda não existe (D-027), então trocá-lo exigiria provar que a pessoa continua
dona do número novo. A senha também não: ela tem o próprio caminho, `ChangePassword`
(`POST /api/accounts/me/password`), com a senha atual conferida pela mesma porta `Credentials` que
o login usa, e o mesmo limite de tentativas (D-097), para uma sessão roubada não virar oráculo de
força bruta contra a senha de verdade.

## E-mail confirmado e troca por link

Toda conta nascida do convite tem o e-mail confirmado. A troca, e a primeira confirmação de uma
conta antiga, passam por link (D-168):

- `POST /api/accounts/me/email` com `{email}` manda ao endereço novo um link para a página de
  `EMAIL_CONFIRM_LINK`, dizendo que ele vale 2 horas. E-mail que já é de outra conta, sem distinguir
  maiúsculas, é recusado com 409, e o pedido passa pelo limite de 5 por hora por conta
  (`AccountLimits`, chave `email-change:<conta>`). Nada muda na conta: o e-mail antigo continua
  valendo, e recuperando a senha, até a confirmação.
- `POST /api/accounts/me/email/confirm` com `{token}` grava o e-mail novo com `email_confirmed_at`
  e devolve a conta. Exige a sessão da conta para a qual o link foi mandado: um link vazado não troca
  o e-mail sozinho, e o front leva a pessoa a entrar e volta ao link. Token forjado, vencido, de
  outra conta ou já usado dá o mesmo 400, "link inválido ou vencido"; endereço que ganhou conta
  depois do envio dá 409.

O token não guarda estado no banco. É o `EmailConfirmation` inteiro, assinado com a chave do
projeto (`EmailConfirmationTokens`): conta, e-mail novo, prazo e a confirmação que a conta tinha ao
pedir. Como toda confirmação muda `email_confirmed_at`, a primeira que acontecer mata todos os links
pedidos antes dela, e o link vale uma vez. A assinatura não esconde o conteúdo: o endereço e o
identificador da conta vão legíveis, mas só para o próprio endereço. O token vai no corpo, nunca no
caminho, e por isso não aparece no log de requisição.

## Conta antiga retida

Conta de antes do convite sem e-mail confirmado entra normalmente, mas fica retida até confirmar um
(D-168), porque é o e-mail que torna a conta responsabilizável (D-160). `AccountOut` traz
`required_action: "confirm_email"`, calculado em `Account.required_action`, e o front leva a pessoa à
troca de e-mail.

- Retido: publicar, editar, mudar vagas, cancelar e repetir carona, pedir contato, cadastrar e tirar
  carro, mandar opinião, `PATCH /api/accounts/me` e trocar a senha. Respondem 403 com
  `{"detail": "confirme seu e-mail para continuar", "required_action": "confirm_email"}`.
- Livre: ver o mural, entrar, sair, `GET /api/accounts/me`, as duas rotas do e-mail, a recuperação
  de senha e a exclusão da conta.

O bloqueio mora na autenticação, não em cada rota: as rotas de escrita usam `writer_auth`, a sessão
de `gated_session_auth` com o `AccountWriteGate` deste contexto, que lê `required_action` pela porta
`AccountRepository`. `shared` só sabe que uma conta pode estar retida, nunca por quê.

## Recuperação de senha

Por e-mail, quando informado (D-092). Sem e-mail, o pedido responde igual e nada é enviado; a
pessoa entra com a senha, confirma um e-mail pelo link e passa a ter recuperação; sem isso, a
recuperação manual fica para quando houver admin. Não há SMS.

## Termos e privacidade

Aceite no cadastro. O texto ainda não foi escrito.
