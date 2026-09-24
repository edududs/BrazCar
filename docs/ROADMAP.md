# Roadmap

## Agora (MVP)

Plataforma que funciona sozinha, sem extrator.

- Esqueleto, tooling e teste de arquitetura. **Feito, tag `v0.1.0`.**
- Teste do SSE pelo túnel do Cloudflare. **Feito, tag `v0.2.0`: SSE confirmado (D-076).**
- `places`: catálogo com nome canônico, apelidos, tipo e lugar pai. **Feito, tag `v0.3.0`.**
- `accounts`: cadastro por telefone, login, carros, recuperação de senha, exclusão de conta. **Feito, tag `v0.4.0`.**
- `rides`: publicar, editar, fechar, reabrir, cancelar, repetir, mural com filtros, contato. **Feito, tag `v0.5.0`; ajustes do teste no celular na `v0.6.0`** (rota A→B, busca por texto em contexto próprio, navegação).
- Tempo real por revisão do mural. **Sinal e invalidação na `v0.5.0`; fechado e medido no app instalado na `v0.7.0`** (D-104, D-107).
- Front e PWA instalável, online-only. **Feito, tag `v0.7.0`** (D-105, D-106).
- **Etapa de design do produto**, depois de todas as peças acima existirem: identidade visual,
  layout e fluxo pensados de verdade. Até lá as telas são funcionais e sem polimento (D-103).
- Deploy na máquina de teste e front no Vercel.

## Depois

- **Passo 7, `importing`.** Em andamento, em dois releases (spec em `docs/specs/importing/`):
  **7a** embute o extrator (worker no compose, `DjangoStore`, pareamento, D-040 testado): **feito, tag
  `v0.8.0`**, mensagens cruas fluindo em produção depois do deploy; **7b** transforma mensagem em carona no mural (candidata,
  parser com LLM local e regras, golden set, carona de motorista externo, ADR-0015 e ADR-0016).
  A carona importada não tem dono com conta, então só expira pelo horário e é apagada ao partir.
- **Passo de qualidade**, o primeiro depois do 7a, que fechou na `v0.8.0`: testes de componente e
  comportamento no front até a cobertura empatar com a do backend, Schemathesis sobre o contrato
  OpenAPI e E2E com Playwright nas jornadas críticas, com screenshots como evidência (D-126).
- **Observações na carona publicada** (`notes`, D-129): passo curto, antes da etapa de design, porque
  muda domínio e contrato.
- **Atualização de carona importada por mensagem posterior** ("lotou", "só 1 vaga", "cancelei"),
  amarrada por remetente e horário. No passo 7 só é classificada e guardada (D-118).
- **Reivindicação da carona importada** pelo motorista que se cadastra com o mesmo telefone. Só
  depois do OTP reverso, porque sem verificação de posse qualquer conta poderia assumi-la (ADR-0015).
- **Paradas por autocomplete com texto livre** no formulário, sem select nem "outro" (D-123):
  entra na etapa de design.
- **`LISTEN/NOTIFY`** como segundo adaptador da porta de revisão, quando um segundo de atraso incomodar.
- **Pedidos de carona.** Passageiro pedindo é outro agregado, com outro ciclo de vida.
- **Verificação de telefone por OTP reverso.** O site mostra um código, a pessoa o envia por
  `wa.me` para o número da plataforma e o extrator, que só lê, confirma a posse do número. Serve
  também para recuperar senha. Só com o extrator plugado; a plataforma não pode depender disso.
- **Limite de requisições no Traefik**, se o da aplicação não bastar.
- **Monitoramento e alerta próprios**, se logs e endpoint de saúde não bastarem.

## Talvez

- **Mapa de paradas.** Fácil, simples e grátis no início. O catálogo já nasce com campo de
  geometria vazio para não exigir remodelagem.
- **Modelagem de lugares como área.** A maioria dos lugares é uma região, não um ponto. Antes de
  modelar coordenadas, pesquisar como Uber, 99 e similares representam zonas e pontos de encontro.
- **Web Push** para "apareceu carona no meu filtro". No iOS exige o app instalado.
- **Reputação de motorista** e avaliação.
- **Carona recorrente** de verdade, com dias da semana. Hoje o "repetir esta carona" cobre o uso.
- **Preço por trecho.** Muda o modelo de rota inteiro.
- **Exportação de dados do usuário.**
- **Gráficos** a partir do histórico de eventos.
