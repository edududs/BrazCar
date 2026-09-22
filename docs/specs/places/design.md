# Desenho (em andamento; apagar ao fechar)

## Agregado

As invariantes de R2 atravessam lugares, então a fronteira de consistência é o catálogo inteiro:
`Catalog` é o agregado, `Place` é entidade dentro dele. Construir um `Catalog` valida tudo; não
existe catálogo inválido em memória. O catálogo tem dezenas de itens, então carregar inteiro
custa duas consultas.

- `PlaceId`: slug estável (`plano-piloto`). Legível na semente e na URL do filtro do mural;
  renomear o lugar não muda o identificador.
- `PlaceName`: texto aparado, 1 a 80 caracteres, com chave de busca não vazia.
- `SearchKey`: `NewType` produzido só por `search_key()` (NFKD sem marcas, `casefold`, espaços
  colapsados). É a única definição de "mesmo texto" do sistema.
- `FrozenModel` em `shared/domain`: `frozen`, `extra="forbid"` e `evolve()`, que devolve cópia
  **revalidada** (`model_copy(update=)` do Pydantic não valida).

## Busca

Feita em memória pelo `Catalog`, em Python. Nenhum recurso de banco entra (nem `unaccent`, nem
coluna de chave): funciona igual em qualquer banco por construção, e o contrato prova a ida e
volta de texto acentuado nos dois. Rever se o catálogo passar de centenas de itens.

## Porta

`CatalogRepository`: `load() -> Catalog` e `save(catalog)`, que substitui o agregado inteiro.
Por isso o contrato não precisa de banco limpo por exemplo: "o último `save` vence" é a propriedade.

## Casos de uso

`SearchPlaces(text)`, `ResolvePlace(place_id)`, `SyncCatalog(catalog)`.

## Adaptadores

`PlaceModel` e `PlaceAliasModel` (com `position`), `DjangoCatalogRepository`, rotas montadas por
`build_router(catalog)` e ligadas em `config/api.py`, que é a raiz de composição. Saída da API por
schema explícito (`PlaceOut`), não pela entidade: o contrato público muda por decisão, e `rides` e
`accounts` vão precisar disso para a regra de privacidade.

## Contrato nos dois bancos

`tests/contracts/`: uma classe de contrato por porta, herdada uma vez por implementação (fake e
Django). O banco é escolhido como em produção, por `DATABASE_URL`: `poe test` roda em SQLite e
`poe test-postgres` roda `-m contract` de novo no Postgres do compose, com `EXPECT_DB_VENDOR`
para o portão não passar no banco errado.
