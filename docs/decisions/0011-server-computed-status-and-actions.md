# 0011 — A API devolve situação e ações permitidas

Status: decidido (2026-09-20). Cobre: D-054.

## Contexto

A situação da carona e as regras de edição e atraso são funções do domínio. Se o front as recalcular em TypeScript, existem duas implementações da mesma regra.

## Decisão

O read-model traz a situação já calculada e a lista de ações permitidas para quem está vendo, como poder editar, poder reabrir e até que horas pode adiar. O front só desenha.

## Alternativas descartadas

- **Recalcular no front.** duas fontes da verdade, e divergência silenciosa quando a regra mudar.
- **Compartilhar a regra por código gerado.** complexidade sem ganho para este tamanho de projeto.

## Consequências

- Mudar uma regra é mexer num lugar só.
- O relógio que vale é o do servidor.
