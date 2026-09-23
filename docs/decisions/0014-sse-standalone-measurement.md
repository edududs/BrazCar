# 0014 — SSE com o app instalado na tela de início

Status: decidido (2026-09-23). Cobre: D-107. Completa [0013](0013-sse-through-tunnel-verdict.md), que
deixou o modo `standalone` sem medir.

## Contexto

O ADR-0013 mediu o sinal do mural numa aba do Safari. Com o PWA publicado (D-106), repetiu-se o
roteiro com o app aberto pelo ícone da tela de início, pela mesma página de diagnóstico, agora com o
batimento `event` a cada 15s que a produção usa e o vigia de silêncio em 45s.

## O que se mediu

iPhone (iOS 18.7, Safari 26.6.1, `displayMode: standalone`), pelo túnel, contra a API `0.6.0`:

| Situação | Resultado |
|---|---|
| Primeiro plano, 2 min | 378 eventos no total da sessão, 0 perdidos, 0 rajadas; atraso médio 48 ms, máximo 455 ms; intervalo de 717 a 1444 ms |
| Tela bloqueada ~40s | ao voltar, `readyState` dizia `open` com 38s sem evento; o erro veio 3 ms depois e a reconexão (`dead-on-resume`) abriu em 214 ms |
| Bloqueada ~2 min | ao voltar, o próprio navegador já estava reconectando; aberta 3,1s depois |
| Bloqueada 10 min | o vigia de silêncio (timer congelado) disparou primeiro; aberta em 188 ms |
| Outro app ~2 min | o vigia disparou primeiro; aberta em 195 ms |
| Wi-Fi desligado pelos Ajustes, volta pelo 4G | vigia, erro, evento `offline` só 2s depois de voltar; aberta em 6,5s pelo 4G; o `online` chegou com a conexão já viva |
| Wi-Fi religado pela Central de Controle, app na tela | a conexão morreu **sem evento nenhum**: nem `hidden`, nem `online`/`offline`, nem erro. Só o vigia percebeu, aos 45s de silêncio; aberta 8,2s depois |

Diferenças em relação à aba do Safari:

- **Sem rajada ao acordar.** Nenhum evento represado foi entregue ao voltar; na aba chegavam ~30 de uma vez.
- **O JavaScript segue 3 a 4s depois de sair do app** (eventos continuaram chegando depois do `hidden`); na aba era ~1s.

## Decisão

- O modo instalado não pede nada novo do adaptador: dúvida ao voltar, `dead-on-resume`, vigia e
  retry do navegador cobriram todos os casos. A regra de rajada (D-077) fica, porque a aba do
  Safari continua existindo.
- **O vigia de silêncio do mural cai de 45s para 35s**: dois batimentos perdidos com folga. Troca de
  rede sem aviso só é notada por ele; o pior caso de mural parado cai de ~53s para ~43s. O custo de
  um falso alarme é uma reconexão.
- **A rota `/api/diagnostics/sse`, a página `/diagnostics` e `SSE_DIAGNOSTICS_TOKEN` ficam**, por
  decisão do Eduardo, como semente de uma telemetria própria (inclusive do aparelho). A página não
  tem link na interface: só se chega a ela digitando o endereço, e ela pede o token num campo.

## Alternativas descartadas

- **Remover o diagnóstico depois da medição**, como previa o ADR-0013. Fica por ser útil e barato.
- **Vigia mais curto que 30s.** Abaixo de dois batimentos, um único `ping` atrasado pelo túnel já
  derruba uma conexão saudável.
- **Ouvir `navigator.connection`.** Não existe no Safari.

## Consequências

- Não medido: o mural atualizando sozinho ao voltar do segundo plano no app instalado (o
  diagnóstico mede o stream, não a busca).
- Até existir telemetria, o diagnóstico continua exigindo que alguém opere o aparelho.
