# Contexto `places`

## Glossário

| No negócio | No código | O que é |
|---|---|---|
| lugar | `Place` | Entrada do catálogo de pontos conhecidos. |
| nome canônico | `name` | Como o lugar aparece no mural: "Esplanada", "Estrutural". |
| apelido | `aliases` | Outras formas de escrever o mesmo lugar: "Braz", "Rodoviária do Plano". |
| tipo | `PlaceKind` | Área ou ponto. A maioria dos lugares é área. |
| lugar pai | `parent_id` | Hierarquia: Esplanada dentro do Plano Piloto. |
| geometria | `geometry` | Campo vazio no MVP. Existe para o mapa não exigir remodelagem. |

## Por que é contexto próprio

O catálogo serve ao filtro do mural e à escolha de paradas ao publicar. Depois servirá à
importação, que precisa mapear texto sujo do WhatsApp para os mesmos lugares canônicos, e ao mapa.

## Invariantes

- Nome canônico é único. Um apelido aponta para um lugar só.
- Filtro por lugar considera os descendentes: filtrar "Plano Piloto" acha "Esplanada".
- `rides` referencia lugar por identificador. Parada em texto livre ("outro") não entra no catálogo.

## Manutenção

Pelo admin do Django. É o único ponto do sistema onde o admin escreve.

## Adiado

Como representar lugar como área: coordenada, polígono ou índice de zona. Pesquisar antes como
Uber, 99 e similares fazem. Ver [ROADMAP.md](../ROADMAP.md).
