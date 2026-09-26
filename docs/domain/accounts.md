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
| e-mail confirmado | `email_confirmed_at`, `email_confirmed` | Quando se provou que o e-mail chega à pessoa. Só existe com e-mail; trocar o e-mail perde a confirmação. |
| telefone verificado | `phone_verified_at` | Previsto no modelo, sem uso no MVP. |
| carro | `Car` | Modelo, cor e placa. Uma conta pode ter vários. |
| placa | `LicensePlate` | Value object. Aceita o formato antigo e o Mercosul, normaliza para maiúsculas sem hífen. |
| pode dirigir | `can_drive` | Derivado: a conta tem pelo menos um carro. É o que `rides` lê para permitir publicar. |
| exclusão de conta | `DeleteAccount` | Caso de uso que apaga a conta no lugar (`erase`): dados pessoais somem, o identificador fica para o histórico. |
| credenciais | `Credentials` | Porta: guarda e confere a senha. O domínio nunca a vê. |
| aceite dos termos | `terms_accepted_at` | Quando a pessoa aceitou os termos no cadastro (D-033). |
| editar dados pessoais | `Account.update_profile`, `UpdateProfile` | Nome social e e-mail, os únicos campos que a própria conta edita (D-139). |
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

`PATCH /api/accounts/me` edita nome social e e-mail, os dois opcionais no corpo: campo ausente
não muda, e-mail em branco (`""`) limpa o e-mail. Trocar o e-mail perde a confirmação, e e-mail de
outra conta é recusado com 409. Nome social, quando enviado, segue a mesma regra do cadastro (não
pode ficar vazio). O telefone não está aqui: ele é a identidade da conta e a
verificação de posse ainda não existe (D-027), então trocá-lo exigiria provar que a pessoa continua
dona do número novo. A senha também não: ela tem o próprio caminho, `ChangePassword`
(`POST /api/accounts/me/password`), com a senha atual conferida pela mesma porta `Credentials` que
o login usa, e o mesmo limite de tentativas (D-097), para uma sessão roubada não virar oráculo de
força bruta contra a senha de verdade.

## Recuperação de senha

Por e-mail, quando informado (D-092). Sem e-mail, o pedido responde igual e nada é enviado; a
pessoa pode agora adicionar um e-mail pela edição de dados pessoais e passar a ter recuperação; sem
isso, a recuperação manual fica para quando houver admin. Não há SMS.

## Termos e privacidade

Aceite no cadastro. O texto ainda não foi escrito.
