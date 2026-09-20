# 0006 — Telefone e placa só pela rota de contato

Status: decidido (2026-09-20). Cobre: D-030, D-031.

## Contexto

O mural é público. A conversão é um link `wa.me`, que contém o telefone, e a placa é a única garantia de achar o carro certo. Somados ao horário e à rota, esses dados permitem coletar o telefone de todos os motoristas e saber onde um carro estará.

## Decisão

O payload do mural traz só nome social, modelo e cor. O botão de contato chama uma rota própria que exige login, aplica limite por conta, grava um `ContactRequest` e devolve o link `wa.me` com mensagem pronta e a placa.

## Alternativas descartadas

- **Telefone na lista.** trivial de raspar.
- **Placa visível no card.** tão raspável quanto o telefone, e só é necessária depois de combinar a carona.
- **Incluir os dados para economizar uma chamada.** é exatamente a otimização que este registro existe para impedir.

## Consequências

- Passageiro também precisa de conta.
- O registro de contatos é a única métrica de conversão possível, já que o fechamento acontece fora da plataforma.
