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
  **Em andamento**, pela identidade "Hora azul" (D-143), em seis passos: (1) fundação — tokens, tema,
  fonte, pele dos primitivos: **feito, tag `v0.16.0`**; (2) casca — abas embaixo, cabeçalho, folhas
  e diálogos; (3) mural e detalhe; (4) publicar, editar, conta e acesso; (5) movimento; (6) canal de
  opinião. Desktop depois do celular aprovado.
- Deploy na máquina de teste e front no Vercel.

## Depois

- **Passo 7, `importing`.** Em andamento, em dois releases:
  **7a** embute o extrator (worker no compose, `DjangoStore`, pareamento, D-040 testado): **feito, tag
  `v0.8.0`**, mensagens cruas fluindo em produção; **7b** transforma mensagem em carona no mural (candidata,
  parser com LLM local e regras, golden set, carona de motorista externo, ADR-0015 e ADR-0016):
  **feito, tag `v0.9.0`**, publicado e importando caronas reais.
  A carona importada não tem dono com conta, então só expira pelo horário e é apagada ao partir.
- **Passo de qualidade**, o primeiro depois do 7a, que fechou na `v0.8.0`: testes de componente e
  comportamento no front até a cobertura empatar com a do backend, Schemathesis sobre o contrato
  OpenAPI e E2E com Playwright nas jornadas críticas, com screenshots como evidência (D-126).
  A parte de ponta a ponta está **feita**: semente de demonstração, suíte do Playwright nas jornadas
  e [catálogo de telas](screens/README.md) (D-133, D-134). Faltam o Schemathesis e a cobertura do
  front chegar à do backend.
- **Observações e preço por parada** (`notes`, D-129; `fare` por parada, D-131). **Feito, tag
  `v0.11.0`**: domínio, contrato, formulário, card e detalhe, e o interpretador lendo o preço de
  cada parada.
- **Telefone como value object composto** (D-135 a D-138). **Feito**: `PhoneNumber` em `shared`
  com país, DDD e assinante, usado por `accounts`, `rides` e `importing`; campo que formata ao
  digitar; número formatado na conta e no contato; e o vínculo da carona importada à conta
  consertado para os endereços de WhatsApp sem o nono dígito.
- **Painel de administração no front**, num caminho próprio e protegido por papel de administrador,
  no lugar do admin do Django (D-124): ver mensagens, candidatas e caronas importadas, disparar o
  reprocessamento (D-130), bloquear remetente, pedidos de contato por conta e alerta de raspagem
  (D-140). Visual cuidado, como os temas de admin costumam dar, dentro da etapa de design ou depois
  dela.
- **Atualização de carona importada por mensagem posterior** ("lotou", "só 1 vaga", "cancelei"),
  amarrada por remetente e horário. No passo 7 só é classificada e guardada (D-118).
- **Reivindicação da carona importada** pelo motorista que se cadastra com o mesmo telefone. Só
  depois do OTP reverso, porque sem verificação de posse qualquer conta poderia assumi-la (ADR-0015).
- **Paradas por autocomplete com texto livre** no formulário, sem select nem "outro" (D-123).
  **Feito, tag `v0.12.1`**: o combobox aceita o que foi digitado e não escolhido na lista como a
  própria parada.
- **`LISTEN/NOTIFY`** como segundo adaptador da porta de revisão, quando um segundo de atraso incomodar.
- **Canal de feedback do usuário**, sempre disponível e discreto: consideração, reclamação, elogio.
  Entra junto com a implementação do design novo, depois da etapa de design (D-103).
- **Favoritar contatos** (motoristas e passageiros de confiança), depois da etapa de design (D-103).
- **Remodelagem da conta como agregado que cresce**, depois da etapa de design (D-103). Hoje
  `Account` é telefone, nome social, e-mail e carros; favoritos, preferências e o que mais vier
  entram por partes, com validação própria, como foi feito com o telefone (D-135), e o modelo é
  revisto quando esses itens entrarem.
- **Pedidos de carona e reserva no próprio app**, depois da etapa de design (D-103). Passageiro
  pedindo é outro agregado, com outro ciclo de vida; registrar e reservar vaga numa carona
  publicada, no lugar de combinar por fora, é outra frente, com avaliação e ranking de motoristas e
  passageiros depois (ver "Reputação de motorista e avaliação" em Talvez). "Levar para o WhatsApp"
  continua sendo o caminho padrão enquanto a maioria estiver lá.
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
- **Reputação de motorista e avaliação**, com ranking de motoristas e de passageiros, junto da
  reserva de carona no próprio app (ver "Pedidos de carona e reserva no próprio app" em Depois).
- **Carona recorrente** de verdade, com dias da semana. Hoje o "repetir esta carona" cobre o uso.
- **Preço conforme o ponto de embarque.** O preço "até a parada" entra com a D-131; cobrar
  diferente conforme onde se embarca exigiria remodelar a rota, e nenhum grupo faz isso hoje.
- **Exportação de dados do usuário.**
- **Gráficos** a partir do histórico de eventos.
