# Contexto `accounts`

## Glossário

| No negócio | No código | O que é |
|---|---|---|
| conta | `Account` | Entidade do domínio. Uma conta só serve a passageiro e a motorista. |
| telefone | `PhoneNumber` | Value object. Identificador de login e destino do link `wa.me`. |
| nome social | `display_name` | Obrigatório. É o único nome exibido no mural, e o cadastro avisa isso. |
| e-mail | `email` | Opcional. Serve só para recuperar a senha. |
| telefone verificado | `phone_verified_at` | Previsto no modelo, sem uso no MVP. |
| carro | `Car` | Modelo, cor e placa. Uma conta pode ter vários. |
| placa | `LicensePlate` | Value object. Aceita o formato antigo e o Mercosul, normaliza para maiúsculas sem hífen. |
| perfil de motorista | `DriverProfile` | Opcional. |
| exclusão de conta | `DeleteAccount` | Caso de uso que anonimiza o histórico em vez de apagar as caronas. |

## Invariantes

- Telefone é único por conta.
- Ver o mural não exige conta. Qualquer interação exige: publicar, pedir contato, editar.
- Publicar carona exige pelo menos um carro.
- A marca do carro não é guardada: o modelo já a traz ("Gol prata", "BYD cinza").
- CPF, CNH e documentos ficam fora.

## Encaixe com o Django

`Account` é do domínio. O usuário customizado do Django, com o telefone como identificador,
existe desde a primeira migration e mora no adaptador, que reaproveita o hash de senha e a sessão
do framework. O domínio não conhece `User`.

## Recuperação de senha

Por e-mail, quando informado. Sem e-mail, recuperação manual pelo admin. Não há SMS.

## Termos e privacidade

Aceite no cadastro. O texto ainda não foi escrito.
