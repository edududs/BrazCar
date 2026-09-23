# 0016 — O LLM extrai, as regras conferem

Status: decidido (2026-09-23). Cobre: D-115, D-116, D-120.

## Contexto

As mensagens dos grupos são curtas, em pt-BR e quase sempre no mesmo molde (vagas, horário, uma
parada por linha, preço), mas as bordas são livres: texto corrido, horário como `6;20`, `17H` ou
dígitos em emoji, "amanhã", preço omitido, só o destino, pedidos de passageiro, "lotou" solto.
Um levantamento de 5,5 dias em seis grupos deu 105 mensagens por dia em média, 42 únicas, com pico
de 143; 45% do texto é repostagem. A máquina de teste tem um Ollama nativo com GPU de 6 GB ociosa, e
o projeto não aceita terceiro para isso (D-008). A lição paga no projeto anterior: saída estruturada
de verdade, temperatura zero, few-shot, um campo "isto não é carona", e nunca criar objeto pela metade.

## Decisão

Porta `RideParser` em `importing/application`, com o resultado tipado em Pydantic. O adaptador Ollama
manda em `format` o JSON schema derivado desse tipo, `temperature 0` e exemplos em pt-BR; a resposta
volta por `model_validate_json`. O schema é plano (`kind` entre oferta, pedido, atualização e outro,
mais campos opcionais), porque união discriminada no schema derruba modelo pequeno; a aplicação
converte o plano no tipo-soma do domínio.

O modelo nunca decide lugar nem data: devolve as paradas como texto e o horário relativo (`time`,
`day`), e o código resolve as paradas contra o catálogo (nome, apelidos, sem acento) e a data a partir
do carimbo da mensagem no fuso do mural. Parada sem casamento vira texto livre.

A confiança é calculada por conferências determinísticas ancoradas no texto (o número de vagas
aparece, o horário aparece, o preço aparece, cada parada aparece, quantas casaram no catálogo), nunca
declarada pelo modelo. O aceite é automático acima de um limiar por variável de ambiente, sem fila.

Um golden set de mensagens reais anonimizadas, com o julgamento esperado, roda no portão pesado contra
o Ollama; o portão rápido usa um fake determinístico. O modelo é o menor que passar no golden set.

## Alternativas descartadas

- **Só regras e regex.** Zero infra e determinístico, cobre o molde comum, mas quebra no texto
  corrido e não distingue pedido de oferta. Continua possível atrás da mesma porta.
- **PLN clássico (spaCy, scikit-learn).** Exige centenas de mensagens rotuladas antes de funcionar
  e extrai pior que regras; o NER genérico em português não conhece "vagas" nem "Esplanada".
- **Só LLM, com lugar, data e confiança vindos do modelo.** Menos código, mas modelo pequeno alucina
  data absoluta e nome de lugar, e confiança autodeclarada não serve de limiar.
- **Regras primeiro, LLM só no resto.** Menos GPU, mas dois parsers para manter e a classificação
  ficaria com o mais fraco. O volume não justifica: uma candidata por vez já é o freio.
- **Bibliotecas de saída estruturada (instructor, pydantic-ai).** Fazem por cima o que o Ollama já
  faz nativo; seriam dependência a mais no adaptador.

## Consequências

- Uma inferência por candidata, uma de cada vez: no pior dia, uns 20 julgamentos e um ou dois
  minutos de atraso no mural. Latência e acerto por modelo são medidos na máquina antes de ligar.
- O Ollama fora do ar não perde nada: a candidata fica pendente e a varredura tenta de novo.
- Trocar de modelo, ou trocar o LLM por regras, é rodar o golden set.
