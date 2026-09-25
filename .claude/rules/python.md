---
paths:
  - "backend/src/**/*.py"
  - "backend/tests/**/*.py"
---

# Backend

- Toolchain: uv, ruff (`select = ["ALL"]` em `ruff.toml`, cada ignore justificado), pyright strict
  em `pyrightconfig.json`, tasks em `poe_tasks.toml`. Config nunca dentro do `pyproject.toml`.
- Cada contexto é um pacote `backend/src/brazcar/<context>/` com `domain/`, `application/` e `adapters/`.
  O app Django do contexto, com models e migrations, mora dentro de `adapters/`.
- Domínio em Pydantic: value objects e entidades `frozen`; mudar estado devolve cópia nova.
  Portas são `Protocol` em `application/ports.py`. Caso de uso é `async`.
- Persistência: o adaptador grava o agregado inteiro numa função síncrona com `transaction.atomic`,
  exposta como `async` por `sync_to_async`. Django 6 não tem transação em modo async (ADR-0008).
- Toda escrita que muda o mural incrementa a revisão do mural na mesma transação (ADR-0010).
- SSE sai por `shared/adapters/sse.py` (quadros e cabeçalhos anti-buffer). Batimento é evento
  `ping` a cada 15s, nunca comentário: o navegador esconde comentários do JavaScript (ADR-0013).
  Rota SSE não segura conexão do ORM.
- Rota que exige login usa `shared/adapters/session_auth.session_auth`; o que chega em
  `request.auth` é só o identificador da conta, lido por `signed_in_account_id(request)`. Método
  que altera estado passa pela checagem de `Origin` do middleware (D-091); não há token de CSRF.
- ninja é adaptador de entrada: traduz HTTP para DTO, chama o caso de uso, traduz erro de
  domínio em resposta. Sem regra de negócio em rota.
- O catálogo de `places` vem de `catalog.toml` pelo comando `sync_places` (D-087). O admin do
  Django, se entrar, é somente leitura, e moderação é ação que chama o caso de uso.
- Testes: domínio sem Django nem banco; Hypothesis para situação da carona e regra de atraso;
  contrato de repositório parametrizado por `DATABASE_URL` (SQLite e Postgres).
