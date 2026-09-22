# Passo 4 — contexto `accounts` (em andamento; apagar ao fechar)

## Requisitos

- R1. `Account` congelada: `id`, `phone` (`PhoneNumber`), `display_name`, `email` opcional,
  `phone_verified_at` (sempre `None` no MVP), `terms_accepted_at`, `cars`. `Car` com `model`,
  `color`, `plate` (`LicensePlate`). Estado inválido não existe: telefone e placa são value objects.
- R2. Usuário customizado do Django, com o telefone como identificador, desde a primeira
  migration de auth (D-028). Só o adaptador o conhece.
- R3. Cadastro: telefone, senha, nome social, e-mail opcional, aceite dos termos. Telefone único.
- R4. Login e logout por sessão em cookie httpOnly `SameSite=Lax` (D-059); checagem de `Origin`
  em toda requisição que altera estado; rota "quem sou eu".
- R5. Carros: adicionar e remover; placa única por conta. Publicar carona exige carro (regra de
  `rides`, que só lerá `cars`).
- R6. Recuperação de senha por e-mail, atrás de porta de envio (D-032); sem e-mail, o fluxo
  responde igual e não envia nada (não vaza quem tem e-mail).
- R7. Exclusão: anonimiza a conta (telefone, nome, e-mail e carros somem; o identificador fica
  para o histórico de `rides`) e encerra a sessão (D-033).
- R8. Telefone e placa nunca saem por lista; neste passo só o dono vê os próprios (D-031).
- R9. Contrato de `AccountRepository` no fake, em SQLite e em Postgres, herdando o molde.
- R10. Front: gateway, tipos próprios e hooks headless de sessão e cadastro com teste; telas
  mínimas de entrar e cadastrar sobre os primitivos.

## Fora

Verificação de telefone (D-034), limite de requisições (D-064, entra com o contato), admin,
texto dos termos (D-033, pendência), perfil de motorista além dos carros.
