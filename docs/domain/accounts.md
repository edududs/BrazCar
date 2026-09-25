# Contexto `accounts`

## Glossário

| No negócio | No código | O que é |
|---|---|---|
| conta | `Account` | Agregado: a conta e seus carros. Uma conta só serve a passageiro e a motorista. |
| identificador | `AccountId` | UUID gerado no domínio; a linha do usuário do Django usa o mesmo (D-090). |
| telefone | `PhoneNumber` | Value object de `shared` (D-135), gravado em E.164 (D-089). Identificador de login e destino do link `wa.me`. |
| telefone de conta | `AccountPhone`, `account_phone` | A regra deste contexto sobre o `PhoneNumber`: só celular do Brasil (D-137). Fixo é `NotAMobilePhoneError`, número de fora é `ForeignPhoneNumberError`. |
| nome social | `display_name` | Obrigatório. É o único nome exibido no mural, e o cadastro avisa isso. |
| e-mail | `email` | Opcional. Serve só para recuperar a senha. |
| telefone verificado | `phone_verified_at` | Previsto no modelo, sem uso no MVP. |
| carro | `Car` | Modelo, cor e placa. Uma conta pode ter vários. |
| placa | `LicensePlate` | Value object. Aceita o formato antigo e o Mercosul, normaliza para maiúsculas sem hífen. |
| pode dirigir | `can_drive` | Derivado: a conta tem pelo menos um carro. É o que `rides` lê para permitir publicar. |
| exclusão de conta | `DeleteAccount` | Caso de uso que apaga a conta no lugar (`erase`): dados pessoais somem, o identificador fica para o histórico. |
| credenciais | `Credentials` | Porta: guarda e confere a senha. O domínio nunca a vê. |
| aceite dos termos | `terms_accepted_at` | Quando a pessoa aceitou os termos no cadastro (D-033). |
| editar dados pessoais | `Account.update_profile`, `UpdateProfile` | Nome social e e-mail, os únicos campos que a própria conta edita (D-139). |
| trocar a senha | `ChangePassword` | Exige a senha atual, verificada pela porta `Credentials`; sem ela, não muda nada (D-139). |

## Invariantes

- Telefone é único por conta.
- Telefone de conta é celular do Brasil. A conta e o contato o mostram como `(61) 99999-9999`.
- Ver o mural não exige conta. Qualquer interação exige: publicar, pedir contato, editar.
- Publicar carona exige pelo menos um carro. Uma placa aparece uma vez por conta.
- A marca do carro não é guardada: o modelo já a traz ("Gol prata", "BYD cinza").
- CPF, CNH e documentos ficam fora.

## Encaixe com o Django

`Account` é do domínio. O usuário customizado do Django, com o telefone como identificador,
existe desde a primeira migration e mora no adaptador, que reaproveita o hash de senha e a sessão
do framework. O domínio não conhece `User`.

## Edição de dados pessoais

`PATCH /api/accounts/me` edita nome social e e-mail, os dois opcionais no corpo: campo ausente
não muda, e-mail em branco (`""`) limpa o e-mail. Nome social, quando enviado, segue a mesma regra
do cadastro (não pode ficar vazio). O telefone não está aqui: ele é a identidade da conta e a
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
