# 0015 — Carona importada dentro de `rides`, com motorista externo e sem conta-sombra

Status: decidido (2026-09-23). Cobre: D-113, D-114. Substitui D-045.

## Contexto

O anúncio de carona dos grupos de WhatsApp precisa aparecer no mural como qualquer outra carona: mesma
lista, mesmos filtros, mesma situação calculada e mesmo botão de contato. Mas ele não tem dono com
conta: `RideOffer` exige `driver_id` de uma `Account` com carro (D-029), e o card mostra o carro.
Quem usa precisa ver a mensagem original que gerou o registro, porque é isso que sustenta a confiança
quando algo parece estranho. E o extrator não sabe distinguir encaminhamento: a mesma carona chega
como quatro mensagens de quatro grupos, com ids diferentes e o mesmo remetente.

## Decisão

A carona importada é uma `RideOffer` do contexto `rides`. Dois campos viram tipo-soma:

- `driver`: `RegisteredDriver(account_id, car)`, o de hoje, ou `ExternalDriver(phone, display_name)`,
  o remetente do WhatsApp. Publicar pela API continua exigindo `RegisteredDriver` com carro.
- `origin`: `Published`, ou `WhatsApp(message_text, group_label, sent_at)`, que o detalhe mostra.

Situação, expiração, filtros, busca e revisão do mural não mudam. `allowed_actions` nunca dá ação de
dono a uma carona de motorista externo. A rota de contato devolve `wa.me` do telefone do remetente,
sem placa. O telefone continua fora de todo payload de lista (D-031).

O contexto `importing` transforma mensagem em carona em três etapas idempotentes: mensagem-fonte
(gravada pelo `DjangoStore`, D-042) vira candidata por remetente, chave de texto normalizado e janela
de 6h; a candidata é julgada (ADR-0016); aceita, vira carona por uma porta para `rides`. Repostagem
do mesmo remetente para a mesma partida se junta à carona existente em vez de criar outra.

Não há conta-sombra. Reivindicar a carona ao se cadastrar com o mesmo telefone fica para depois da
verificação de posse por OTP reverso (D-034), que o próprio extrator viabiliza.

## Alternativas descartadas

- **Conta-sombra criada pelo telefone do remetente, reivindicada no cadastro.** Caminho natural
  para o motorista virar usuário, mas sem verificação de posse (D-027) qualquer usuário logado obtém
  o telefone pela rota de contato, cadastra-se com ele, assume a sombra e cancela as caronas do
  motorista real. Só é seguro com o OTP.
- **Agregado próprio em `importing` com read model no mesmo mural.** Isola, mas duplica situação,
  ações, contato, privacidade, filtros e busca. Duas fontes para uma regra.
- **`driver_id` nulável e `phone` solto na carona.** Estado inválido representável (conta e telefone
  ao mesmo tempo, ou nenhum). O tipo-soma torna cada forma completa por construção.
- **Guardar a mensagem original só em `importing` e buscá-la por porta no detalhe.** `rides`
  passaria a depender de `importing` para mostrar uma carona. O texto vai na origem da carona e some
  com ela (D-119).

## Consequências

- Migração em `rides`: referência à conta e carro viram opcionais no banco, com telefone e nome do
  remetente e os campos da origem; o domínio continua sem nulos soltos.
- O card e o detalhe passam a lidar com carona sem carro; o contato, com resposta sem placa.
- Reivindicação de carona, e o OTP que a permite, são o incremento seguinte natural do extrator.
