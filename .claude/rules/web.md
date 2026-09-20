---
paths:
  - "web/**/*.ts"
  - "web/**/*.tsx"
  - "web/**/*.css"
---

# Front

- yarn 4, nunca npm. Pipeline: prettier, eslint `strictTypeChecked`, `tsc --noEmit`. Sem `any`.
- Organização por funcionalidade: `web/src/features/<rides|accounts|places>/` com quatro camadas
  dentro (`domain`, `app`, `ui`, `adapters`), mais `web/src/shared/` para primitivos e tokens.
  - `domain`: tipos e contratos puros, zero runtime.
  - `app`: hooks headless, estado e comportamento, zero markup e zero CSS.
  - `ui`: visual. Consome hooks, não reimplementa lógica. Views compõem primitivos, quase sem tag crua.
  - `adapters`: único lugar que conhece fetch, SSE, service worker e tipos gerados.
- Tipos da API são gerados do `contract/openapi.json` com `openapi-typescript` e ficam em `adapters`.
  Não escrever tipo de contrato à mão.
- O front não recalcula regra de negócio. A API devolve a situação da carona e as ações
  permitidas; a tela só desenha (ADR-0011).
- Dados: TanStack Query. O sinal SSE de revisão do mural invalida a consulta; nunca carrega dados.
  Refazer a busca ao focar a aba e ao voltar a rede é obrigatório, por causa do iOS.
- Rotas: TanStack Router. Filtros do mural vivem na URL.
- Primitivos sobre biblioteca headless (React Aria ou Base UI) com Tailwind v4 e tokens em
  variáveis CSS. Acessibilidade de diálogo, menu e sheet não se faz à mão.
- PWA online-only: o service worker só pré-carrega a casca. Sem rede, tela de aviso.
  Atualização em modo `prompt`. Respeitar safe-area e detectar modo standalone num adaptador só.
