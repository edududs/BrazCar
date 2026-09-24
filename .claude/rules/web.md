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
- SSE só por `shared/adapters/resilient-event-source.ts`, nunca `EventSource` cru. Reconectar é
  caminho feliz, não erro; eventos que chegam em rajada ao acordar valem um sinal só (ADR-0013).
- Rotas: TanStack Router. Filtros do mural vivem na URL.
- Testar componente e comportamento, não só hook: o que a pessoa faz na tela (clicar, digitar,
  submeter, ver o estado mudar) precisa de teste com Testing Library. Fluxo conferido à mão vira
  teste no mesmo passo (D-109). A meta de cobertura do front é a mesma do backend.
- Primitivos sobre o Base UI (D-088), embrulhados em `shared/ui/`, com Tailwind v4 e tokens em
  variáveis CSS. Acessibilidade de diálogo, menu e sheet não se faz à mão.
- PWA online-only (D-106): o service worker só pré-carrega a casca, sem `runtimeCaching`. Sem rede,
  tela de aviso por cima da página montada. Atualização em modo `prompt`, e tela com digitação em
  andamento chama `useUnsavedWork()`. Respeitar safe-area e detectar modo standalone num adaptador só.
- Versão do front é o `version` do `package.json`, que o `scripts/release.sh` acompanha; nunca
  editar à mão fora do release (D-105).
- iOS só registra service worker em contexto seguro: testar PWA no celular pelo HTTPS publicado.
  Numa aba em segundo plano do Chrome automatizado `visibilityState` é `hidden`, e o refetch ao
  focar não dispara; `visibilitychange` sintético precisa de `bubbles: true` para o TanStack ver.
