# Vigia da bandeja do Windows

Um arquivo, `tools/health-watch/health-watch.ps1`, que fica em segundo plano como ícone na bandeja e
consulta duas rotas públicas da API: `GET /api/health` (a API está viva?) e `GET /api/health/importing`
(a importação das caronas está funcionando? D-193). Não usa credencial nem instala nada: roda no
Windows PowerShell 5.1, que já vem no Windows (D-194).

## O que faz

- Checa ao abrir e a cada 5 minutos.
- Muda a cor do ícone e avisa com uma notificação do Windows **só quando o estado muda**, inclusive na
  volta ao normal.
- O texto ao passar o mouse mostra o estado e a hora da última checagem.
- Uma só instância por vez: abrir de novo não duplica.

## Como abrir

Pelo PowerShell, na raiz do repositório:

```powershell
powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File tools\health-watch\health-watch.ps1
```

Parâmetros opcionais: `-ApiBase` (padrão `https://api-brazcar.elj-labs.org`) e `-IntervalMinutes`
(padrão 5).

## Iniciar com o Windows

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools\health-watch\health-watch.ps1 -Install
```

Cria o atalho `BrazCar Vigia.lnk` na pasta de inicialização do usuário, com o caminho absoluto do
script: se a pasta do repositório mudar de lugar, instalar de novo. Não inicia o vigia na hora.
`-Uninstall` remove o atalho.

## O que cada cor significa

| Cor | Significado |
|---|---|
| Verde | API viva e importação `ok`. |
| Amarelo | Importação `degraded`. O motivo vai na notificação: o interpretador das mensagens está falhando, ou nenhuma mensagem foi recebida há mais de 8 horas. |
| Vermelho | API fora: tempo esgotado, erro de rede ou resposta diferente de 200 em `/api/health`, em duas checagens seguidas. Uma falha só não alarma. |
| Cinza | Checando, importação `off` (sem grupos observados no processo da API) ou API ainda sem a rota nova (404). Sem alarme. |

## Menu e como parar

Botão direito no ícone: **Checar agora**, **Abrir mural** e **Sair**. Sair retira o ícone da bandeja.
Para não iniciar mais com o Windows, `-Uninstall`.

## Teste sem abrir a interface

`-NoUi` carrega só as funções, para provar a decisão de cor (`Resolve-WatchState`) sem ícone:

```powershell
. .\tools\health-watch\health-watch.ps1 -NoUi
Resolve-WatchState -ApiAlive $true -Importing degraded -Reason parser_failing
```
