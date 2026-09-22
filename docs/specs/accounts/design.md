# Desenho (em andamento; apagar ao fechar)

## Agregado

`Account` com seus `cars`. Fronteira: uma conta. Telefone único é invariante entre contas, então
mora no banco (unique) e o repositório traduz a violação em `PhoneAlreadyRegisteredError`.

- `PhoneNumber`: celular brasileiro. Aceita o que a pessoa digita ("61 99999-9999",
  "+55 61 9 9999 9999"), guarda E.164 (`+5561999999999`). É o destino do `wa.me`.
- `LicensePlate`: formato antigo (`ABC1234`) e Mercosul (`ABC1D23`), maiúsculas sem hífen.
- `AccountId`: UUID gerado no domínio, para `rides` referenciar sem esperar o banco.
- A senha nunca entra no domínio: é credencial do adaptador (hash do Django).

## Portas

- `AccountRepository`: `get(id)`, `by_phone(phone)`, `save(account)` (insere ou substitui a
  conta e seus carros, `atomic`), `erase(id, tombstone)`.
- `Credentials`: `register(account_id, password)`, `verify(phone, password) -> AccountId | None`,
  `change(account_id, password)`. Adaptador: o usuário do Django.
- `PasswordResetTokens`: `issue(account_id) -> token`, `redeem(token) -> AccountId | None`.
  Adaptador: `PasswordResetTokenGenerator` do Django, com validade de ambiente.
- `Mailer` em `shared/application`: `send(to, subject, body)`. Adaptador: `send_mail` do Django
  sobre SMTP (Resend por env, D-032). Em teste, o backend `locmem`.

## Casos de uso

`RegisterAccount`, `LogIn`, `AddCar`, `RemoveCar`, `RequestPasswordReset`, `ResetPassword`,
`DeleteAccount`. A sessão (criar/destruir) é do adaptador: a rota chama o caso de uso e depois
`alogin`/`alogout`.

## Sessão e origem

`django.contrib.sessions` + `auth` com o usuário customizado; `SESSION_COOKIE_SAMESITE=Lax`,
`HttpOnly`, `Secure` fora de debug. `OriginCheckMiddleware` em `shared/adapters`: método que
altera estado precisa de `Origin` em `CORS_ALLOWED_ORIGINS` ou igual à própria origem; senão 403.
É a checagem de D-059 sem token de CSRF, que não atravessa origens.

## API (todas sob `/api/accounts`)

`POST /register`, `POST /login`, `POST /logout`, `GET /me`, `POST /cars`, `DELETE /cars/{id}`,
`POST /password-reset`, `POST /password-reset/confirm`, `DELETE /me`. Schemas de saída próprios.
