# BrazCar

Plataforma de caronas entre Brazlândia e o centro de Brasília: registrar ofertas de carona e
encontrá-las num mural. Monorepo com `src/` (Django 6 + django-ninja) e `web/` (React 19 + TS).

Este arquivo é o único sempre carregado. Todo o resto é sob demanda: comece por
[docs/INDEX.md](docs/INDEX.md) e, no início de uma sessão de trabalho, leia [docs/STATE.md](docs/STATE.md).

## Regras invioláveis

1. **Idioma.** Código, identificadores, pastas e nomes de arquivo em inglês. Conteúdo de
   documentação e textos de interface em pt-BR.
2. **Hexágono.** `domain/` e `application/` só importam stdlib, Pydantic e a própria camada.
   Django, ninja e qualquer SDK moram em `adapters/`. Um teste de arquitetura por AST garante isso.
3. **Dependência externa entra por porta e adaptador.** Trocar fornecedor custa um adaptador e
   variáveis de ambiente. Terceiros aceitos hoje: Vercel (front), Resend (e-mail), Cloudflare (domínio).
4. **Fonte única.** Situação da carona é calculada, nunca gravada. Regras de negócio vivem no
   backend; o front recebe a situação e as ações permitidas prontas.
5. **Um agregado, uma transação**, dentro do adaptador. Ver ADR-0008 antes de tocar em persistência.
6. **Privacidade.** Telefone e placa nunca entram em payload de lista. Só saem pela rota de contato.
7. **Repo do extrator é somente leitura.** Integração se resolve aqui, por adaptador.
8. **Sem tipos frouxos.** Nunca `Any` nem `any`. Pipeline antes de declarar pronto:
   `uv run poe fix` no backend, `yarn fix` no front.
9. **Commits.** Conventional Commits, sem trailers (nada de `Co-Authored-By`) e sem citar
   ferramentas usadas na autoria. Push é só do Eduardo.
10. **Documentação no mesmo commit.** Decisão nova vira linha em
    [docs/decisions/README.md](docs/decisions/README.md); decisão antiga nunca é editada, é substituída.
11. **Segredos.** Nunca ler nem versionar tokens. Arquivos de ambiente ficam fora do repo.

## Onde está cada coisa

| Preciso de | Vá para |
|---|---|
| Estado atual e próximo passo | `docs/STATE.md` |
| O que o produto é e não é | `docs/product.md` |
| Blocos, fluxos e fronteiras | `docs/architecture.md` |
| Por que algo foi decidido | `docs/decisions/README.md` |
| Vocabulário e invariantes de um contexto | `docs/domain/<context>.md` |
| O que vem depois | `docs/ROADMAP.md` |

Regras por área carregam sozinhas ao tocar os arquivos: `.claude/rules/`.
