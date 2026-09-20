---
paths:
  - "backend/src/**/domain/**"
  - "backend/src/**/application/**"
---

# Domínio e aplicação

- Antes de nomear qualquer coisa, consulte o glossário do contexto em `docs/domain/<context>.md`.
  Um conceito tem um nome só no código. Não invente sinônimo.
- Proibido importar Django, ninja, ORM ou SDK aqui. Só stdlib, Pydantic e a própria camada.
- Estado inválido não deve ser representável: prefira value object e tipo-soma a campos soltos
  e nuláveis. Validação no construtor, falha cedo.
- Situação da carona é função pura de quatro dados (ADR-0003). Não criar campo de situação.
- A entidade emite eventos de domínio; o repositório os persiste junto com o estado (ADR-0005).
  Nenhuma regra de domínio lê o histórico.
- Referência entre contextos é por identificador, nunca por objeto de outro contexto.
