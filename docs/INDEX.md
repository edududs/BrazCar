# Índice da documentação

Uma linha por documento. Abra só o que a tarefa pede.

| Documento | Para quê | Atualiza quando |
|---|---|---|
| [STATE.md](STATE.md) | Onde o projeto está e o próximo passo. Único arquivo datado. | Fim de cada sessão de trabalho |
| [ROADMAP.md](ROADMAP.md) | Agora, depois, talvez. Inclui o backlog pós-MVP. | Escopo fecha ou é adiado |
| [product.md](product.md) | Problema, usuários, o que o produto faz e não faz. | Escopo de produto muda |
| [architecture.md](architecture.md) | Contexto, blocos, fluxos, conceitos transversais. | Fronteira de contexto ou dependência externa muda |
| [decisions/README.md](decisions/README.md) | Tabela de todas as decisões, com status. | Toda decisão nova |
| `decisions/NNNN-*.md` | Registro completo das decisões cujo motivo não é óbvio. | Imutável; decisão nova substitui |
| [domain/rides.md](domain/rides.md) | Glossário e invariantes de caronas. | Conceito muda ou é renomeado |
| [domain/accounts.md](domain/accounts.md) | Glossário e invariantes de contas. | Idem |
| [domain/places.md](domain/places.md) | Glossário e invariantes de lugares. | Idem |

| [specs/sse-tunnel-test/plan.md](specs/sse-tunnel-test/plan.md) | Plano e resultados do teste de risco do SSE (passo 2). | Efêmero: apagado ao fechar o passo |
| [runbooks/deploy.md](runbooks/deploy.md) | Como a API e o front são publicados, e as armadilhas já pagas. | O procedimento de deploy muda |

`specs/<feature>/` é efêmero: spec, design e tarefas da feature em andamento, apagado após o merge.

Não se documenta o que uma busca no código responde: estrutura de pastas, assinaturas, lista de
endpoints, campos de model, comandos do `poe_tasks.toml`.
