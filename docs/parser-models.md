# Medições do interpretador

O interpretador de mensagens (D-115, ADR-0016) é um modelo local rodando no Ollama, escolhido pelo
golden set (D-120): 120 mensagens reais dos grupos, anonimizadas, com a leitura que cada uma deve
receber, em `backend/tests/importing/golden/messages.jsonl`. Quem rodar o projeto em outra máquina
mede os modelos que tem e escolhe o seu; o escolhido vai em `RIDE_PARSER_MODEL`.

## Como medir

```bash
cd backend
OLLAMA_BASE_URL=http://127.0.0.1:11434 RIDE_PARSER_MODEL=qwen3.5:4b uv run poe test-golden
```

O teste é pesado e só roda com `OLLAMA_BASE_URL` definido. Ele imprime uma linha de resumo e, para
cada erro, o que era esperado e o que veio. As métricas:

- **tipo**: fração das 120 mensagens cujo `kind` (oferta, pedido, atualização, outro) saiu certo.
  Piso: 90%.
- **campos**: fração dos campos das ofertas (`time`, `day`, `seats`, `price`, `stops`) lidos como
  o rótulo. Paradas são comparadas por substância: sem detalhe entre parênteses, "A/B" e "A ou B"
  como duas, sem quadra só numérica. Piso: 80%.
- **latência**: mediana e máxima por mensagem, em segundos, com o modelo já carregado na GPU. A
  primeira chamada depois de ocioso carrega o modelo e pode passar de dez segundos.

Os pisos vivem no próprio teste (`KIND_FLOOR`, `OFFER_FLOOR`). O modo pensante dos modelos que o
têm fica desligado pelo adaptador: com ele ligado uma resposta levou 49 s.

## Medições

| Data | Modelo | Onde | GPU | Ollama | Tipo | Campos | Mediana | Máxima | Passou |
|---|---|---|---|---|---|---|---|---|---|
| 2026-09-24 | `qwen3.5:4b` | notebook do Eduardo | RTX 4050 6 GB | 0.34.3 | 95% | 92% | 1,3 s | 11,3 s | sim |
| 2026-09-24 | `qwen2.5:7b-instruct` | notebook do Eduardo | RTX 4050 6 GB | 0.34.3 | 91% | 93% | 3,1 s | 14,2 s | sim |
| 2026-09-24 | `qwen2.5:3b-instruct` | notebook do Eduardo | RTX 4050 6 GB | 0.34.3 | 91% | 74% | 0,7 s | 6,5 s | não: erra o dia em 56 ofertas |
| 2026-09-24 | `qwen3.5:4b` | trovva-internal (produção) | GTX 1060 6 GB | 0.24.0 | 94% | 91% | 4,3 s | 69,5 s | sim (máxima inflada: outra medição dividia a GPU) |
| 2026-09-24 | `gemma3:4b` | trovva-internal (produção) | GTX 1060 6 GB | 0.24.0 | 92% | 83% | 4,0 s | 30,5 s | sim, mas abaixo do qwen3.5 nos campos |

O `qwen3.5:4b` é o padrão (`RIDE_PARSER_MODEL`): acerta mais o tipo, empata nos campos e responde
em metade do tempo do `7b`, ocupando 3,4 GB. Na máquina de produção ele leva uns 4 s por mensagem:
com 42 mensagens únicas por dia, são minutos de GPU por dia. Onde ele errou, o `7b` errou parecido: os dois
confundem atualização com oferta em textos como "2 vagas" postados logo após uma oferta, e listam
paradas com pontuação diferente do rótulo.

Ao medir em outra máquina, acrescente uma linha com o que o teste imprimiu, sem arredondar por
cima; uma medição que não passou também entra, com o motivo.
