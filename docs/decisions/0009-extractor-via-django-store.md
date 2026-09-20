# 0009 — Extrator embutido por adaptador, sem tocar no repo dele

Status: decidido (2026-09-20). Cobre: D-040 a D-044.

## Contexto

O extrator de WhatsApp é um projeto separado, com SQLAlchemy e Alembic próprios. A porta de escrita dele tem só `save`. O barramento de eventos é em processo e sem retry, e `save` e `publish` não são transacionais.

## Decisão

O repo do extrator é somente leitura. Um `DjangoStore` neste repo implementa a porta de escrita com model e migration do Django (JSONField, unicidade por conta e id da mensagem) e é passado para `bootstrap.run`. O extrator roda como management command em serviço próprio do compose, com reinício automático. A importação lê da tabela com marcador de processada, e o evento só acorda o consumidor. As tabelas `whatsmeow_*`, criadas pelo código Go, ficam isoladas por um usuário de banco com `search_path` próprio (proposto, falta testar).

## Alternativas descartadas

- **Manter o Alembic do extrator no mesmo banco.** dois sistemas de migração num banco só.
- **Criar a carona direto no handler do evento.** um restart entre `save` e `publish` perderia a mensagem.
- **Rodar o extrator dentro do processo web.** ele é um laço de longa duração, e panic do Go mata o processo sem exceção Python.

## Consequências

- Logging: basta declarar `root` com handler no `LOGGING`, e o `basicConfig` do neonize não faz nada.
- Um processo por conta de WhatsApp.
- Se uma correção for muito melhor no extrator, ela é levada ao dono daquele repo, não aplicada daqui.
