# Contexto `places`

## Glossário

| No negócio | No código | O que é |
|---|---|---|
| catálogo | `Catalog` | O conjunto de todos os lugares. É o agregado: guarda as invariantes entre lugares (D-083). |
| lugar | `Place` | Entrada do catálogo de pontos conhecidos. |
| identificador | `PlaceId` | Slug estável, como `plano-piloto`. Não muda quando o lugar é renomeado (D-084). |
| nome canônico | `name` | Como o lugar aparece no mural: "Esplanada", "Estrutural". |
| apelido | `aliases` | Outras formas de escrever o mesmo lugar: "Braz", "Rodoviária do Plano". |
| tipo | `PlaceKind` | Área ou ponto. A maioria dos lugares é área. |
| lugar pai | `parent_id` | Hierarquia: Esplanada dentro do Plano Piloto. |
| geometria | `geometry` | Campo vazio no MVP. Existe para o mapa não exigir remodelagem. |
| chave de busca | `SearchKey` | O texto sem acento, sem caixa e sem espaço sobrando. Dois textos com a mesma chave são o mesmo texto. |
| lugar resolvido | `ResolvedPlace` | Um lugar com todos os seus descendentes, para o filtro. |

## Por que é contexto próprio

O catálogo serve ao filtro do mural e à escolha de paradas ao publicar. Depois servirá à
importação, que precisa mapear texto sujo do WhatsApp para os mesmos lugares canônicos, e ao mapa.

## Invariantes

- Nome canônico é único. Um apelido aponta para um lugar só. A comparação é pela chave de busca:
  "brazlandia" e "Brazlândia" são o mesmo texto.
- O lugar pai existe no catálogo, e a hierarquia não tem ciclo.
- Filtro por lugar considera os descendentes: filtrar "Plano Piloto" acha "Esplanada".
- `rides` referencia lugar por identificador. Parada em texto livre ("outro") não entra no catálogo.

## Manutenção

Pelo arquivo `backend/src/brazcar/places/adapters/catalog.toml`, que é a fonte, e pelo comando
`manage.py sync_places`, que deixa o banco igual ao arquivo (D-087). Mudar o catálogo é editar o
arquivo e fazer commit; o comando roda no entrypoint da API, depois da migração.

## Adiado

Como representar lugar como área: coordenada, polígono ou índice de zona. Pesquisar antes como
Uber, 99 e similares fazem. Ver [ROADMAP.md](../ROADMAP.md).
