# Fonte de destaque

O front carrega uma fonte só, a Bricolage Grotesque em peso 700, para horários, títulos e a marca
(D-145). O corpo do texto é a fonte do sistema. O arquivo e a licença ficam em `web/public/fonts/`
e são versionados; nada vem de serviço de fontes.

## Refazer o arquivo

Só quando a fonte de origem mudar ou o subconjunto precisar de outra letra:

```bash
uv run scripts/subset-display-font.py
```

O script baixa o TTF variável do repositório do Google Fonts, fixa um peso e um tamanho óptico,
corta para o latino básico mais as letras do pt-BR, mantém só kerning e algarismos tabulares, e
grava o `woff2` com a `OFL.txt` ao lado. As dependências (`fonttools`, `brotli`) vêm do cabeçalho
do próprio script; não entram no backend.

## O teto

`web/src/shared/ui/design-budget.test.ts` recusa o arquivo acima de 30 KiB. Hoje ele tem cerca de
28 KiB, e metade é a tabela de kerning. Se o teto estourar, a prancha F6 do canvas já decidiu a
saída: SF Pro Display com algarismos tabulares, sem fonte hospedada.
