# Ativos de design: fonte e ícones

Dois ativos gerados por script e versionados: a fonte de destaque e os ícones do app. Nada vem de
serviço de terceiros.

## Fonte de destaque

O front carrega uma fonte só, a Bricolage Grotesque em peso 700, para horários, títulos e a marca
(D-145). O corpo do texto é a fonte do sistema. O arquivo e a licença ficam em `web/public/fonts/`.

Refazer, só quando a fonte de origem mudar ou o subconjunto precisar de outra letra:

```bash
uv run scripts/subset-display-font.py
```

O script baixa o TTF variável do repositório do Google Fonts, fixa um peso e um tamanho óptico,
corta para o latino básico mais as letras do pt-BR, mantém só kerning e algarismos tabulares, e
grava o `woff2` com a `OFL.txt` ao lado. As dependências (`fonttools`, `brotli`) vêm do cabeçalho
do próprio script; não entram no backend.

`web/src/shared/ui/design-budget.test.ts` recusa o arquivo acima de 30 KiB. Hoje ele tem cerca de
28 KiB, e metade é a tabela de kerning. Se o teto estourar, a prancha F6 do canvas já decidiu a
saída: SF Pro Display com algarismos tabulares, sem fonte hospedada.

## Ícones do app

A marca é o símbolo da prancha F2, duas paradas ligadas por uma linha sobre o Anil (D-149). O
desenho existe em três lugares que precisam concordar: o componente `BrandMark` em
`web/src/shared/ui/brand-mark.tsx`, o `web/public/favicon.svg` (cantos já arredondados, para a aba
do navegador) e o `web/public/icon.svg` (quadrado inteiro, porque iOS e Android arredondam sozinhos
e o ícone maskable precisa da sangria). Os PNG do manifesto e o `apple-touch-icon` saem do
`icon.svg`:

```bash
cd web && node ../scripts/app-icons.mjs
```

O script desenha o SVG num Chromium do Playwright e fotografa em 192, 512 e 180. Rodar só quando o
símbolo mudar; os PNG são versionados.
