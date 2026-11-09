<#
.SYNOPSIS
  Vigia do BrazCar: ícone na bandeja do Windows que consulta a API e avisa quando algo para.

.DESCRIPTION
  Consulta apenas rotas públicas: GET /api/health (a API está viva?) e GET /api/health/importing
  (a importação das caronas está funcionando?). Roda no Windows PowerShell 5.1, sem dependências.
  Ver docs/runbooks/health-watch.md.

.PARAMETER ApiBase
  Endereço da API, sem barra final.

.PARAMETER IntervalMinutes
  Intervalo entre as checagens.

.PARAMETER Install
  Cria um atalho na pasta de inicialização do usuário e sai, sem iniciar o vigia.

.PARAMETER Uninstall
  Remove o atalho da pasta de inicialização e sai.

.PARAMETER NoUi
  Só carrega as funções (para teste com dot-source); não abre ícone nem timer.
#>
[CmdletBinding()]
param(
    [string]$ApiBase = 'https://api-brazcar.elj-labs.org',
    [int]$IntervalMinutes = 5,
    [switch]$Install,
    [switch]$Uninstall,
    [switch]$NoUi
)

$ErrorActionPreference = 'Stop'

$DefaultApiBase = 'https://api-brazcar.elj-labs.org'
$BoardUrl = 'https://brazcar.elj-labs.org'
$MutexName = 'Local\BrazCarHealthWatch'
$ShortcutName = 'BrazCar Vigia.lnk'
$TimeoutSeconds = 20
$FailuresToAlarm = 2

$ReasonText = @{
    'parser_failing'     = 'o interpretador das mensagens está falhando'
    'no_recent_messages' = 'nenhuma mensagem recebida há horas'
}

# ---------------------------------------------------------------------------------------------
# Decisão pura: recebe o resultado das checagens e devolve estado, motivo e texto. Sem UI, sem rede.
#   Estado: green, yellow, red, gray, ou keep (primeira falha: mantém o que já está na tela).
#   -Importing: 'ok', 'degraded', 'off' ou '' (rota ausente, API antiga, resposta ilegível).
# ---------------------------------------------------------------------------------------------
function Resolve-WatchState {
    param(
        [bool]$ApiAlive,
        [int]$ConsecutiveFailures = 0,
        [string]$Importing = '',
        [string]$Reason = ''
    )

    if (-not $ApiAlive) {
        if ($ConsecutiveFailures -ge $FailuresToAlarm) {
            return [pscustomobject]@{ State = 'red'; Text = 'API fora do ar' }
        }
        return [pscustomobject]@{ State = 'keep'; Text = 'Falha na checagem, tentando de novo' }
    }

    switch ($Importing) {
        'ok' {
            return [pscustomobject]@{ State = 'green'; Text = 'Tudo certo' }
        }
        'degraded' {
            $why = $ReasonText[$Reason]
            if (-not $why) { $why = 'importação com problema' }
            return [pscustomobject]@{ State = 'yellow'; Text = "Importação com problema: $why" }
        }
        'off' {
            return [pscustomobject]@{ State = 'gray'; Text = 'API viva, importação desligada' }
        }
        default {
            return [pscustomobject]@{ State = 'gray'; Text = 'API viva, importação sem informação' }
        }
    }
}

# O que mudou entre dois estados decide se há notificação. Devolve $null quando não há.
function Resolve-Notification {
    param(
        [string]$PreviousKey,
        [string]$Key,
        [string]$State,
        [string]$Text,
        [string]$Clock,
        [string]$DownSince
    )

    if ($State -eq 'keep' -or $Key -eq $PreviousKey) { return $null }
    $wasProblem = $PreviousKey -like 'red*' -or $PreviousKey -like 'yellow*'

    switch ($State) {
        'red' { return "BrazCar fora do ar desde $DownSince" }
        'yellow' { return "$Text ($Clock)" }
        default {
            if ($wasProblem) { return "BrazCar voltou ao normal às $Clock" }
            return $null
        }
    }
}

function Limit-Text {
    param([string]$Text, [int]$Max = 63)
    if ($Text.Length -le $Max) { return $Text }
    return $Text.Substring(0, $Max - 1) + '…'
}

# ---------------------------------------------------------------------------------------------
# Rede
# ---------------------------------------------------------------------------------------------
function Get-StatusCode {
    param($ErrorRecord)
    $response = $ErrorRecord.Exception.Response
    if ($null -eq $response) { return 0 }
    return [int]$response.StatusCode
}

# Devolve @{ Alive; Importing; Reason }. Qualquer falha de /api/health conta como API fora.
function Get-ApiReading {
    param([string]$Base)

    try {
        $null = Invoke-RestMethod -UseBasicParsing -TimeoutSec $TimeoutSeconds -Uri "$Base/api/health"
    }
    catch {
        return [pscustomobject]@{ Alive = $false; Importing = ''; Reason = '' }
    }

    try {
        $body = Invoke-RestMethod -UseBasicParsing -TimeoutSec $TimeoutSeconds -Uri "$Base/api/health/importing"
        $reason = ''
        if ($body.reason) { $reason = [string]$body.reason }
        return [pscustomobject]@{ Alive = $true; Importing = [string]$body.status; Reason = $reason }
    }
    catch {
        # 404 é API antiga, sem a rota; qualquer outra falha também fica em cinza, sem alarme.
        return [pscustomobject]@{ Alive = $true; Importing = ''; Reason = '' }
    }
}

# ---------------------------------------------------------------------------------------------
# Instalação: atalho na pasta de inicialização, sem iniciar o vigia
# ---------------------------------------------------------------------------------------------
function Get-ShortcutPath {
    return Join-Path ([Environment]::GetFolderPath('Startup')) $ShortcutName
}

function Install-Shortcut {
    param([string]$ScriptPath, [string]$Base)

    $arguments = '-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + $ScriptPath + '"'
    if ($Base -ne $DefaultApiBase) { $arguments += ' -ApiBase "' + $Base + '"' }

    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut((Get-ShortcutPath))
    $shortcut.TargetPath = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
    $shortcut.Arguments = $arguments
    $shortcut.WorkingDirectory = Split-Path -Parent $ScriptPath
    $shortcut.WindowStyle = 7
    $shortcut.Description = 'Vigia do BrazCar'
    $shortcut.Save()
    Write-Host ('Atalho criado em ' + (Get-ShortcutPath))
}

function Uninstall-Shortcut {
    $path = Get-ShortcutPath
    if (Test-Path -LiteralPath $path) {
        Remove-Item -LiteralPath $path -Force
        Write-Host "Atalho removido: $path"
    }
    else {
        Write-Host 'Nenhum atalho para remover.'
    }
}

if ($NoUi) { return }

if ($Install) { Install-Shortcut -ScriptPath $PSCommandPath -Base $ApiBase; return }
if ($Uninstall) { Uninstall-Shortcut; return }

# ---------------------------------------------------------------------------------------------
# Casca de UI: só desenha e notifica
# ---------------------------------------------------------------------------------------------
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type -Namespace BrazCar -Name Native -MemberDefinition '[System.Runtime.InteropServices.DllImport("user32.dll")] public static extern bool DestroyIcon(System.IntPtr handle);'

$createdNew = $false
$mutex = New-Object System.Threading.Mutex($true, $MutexName, [ref]$createdNew)
if (-not $createdNew) { return }

[System.Windows.Forms.Application]::EnableVisualStyles()

$Colors = @{
    green  = [System.Drawing.Color]::FromArgb(46, 160, 67)
    yellow = [System.Drawing.Color]::FromArgb(230, 170, 0)
    red    = [System.Drawing.Color]::FromArgb(207, 34, 46)
    gray   = [System.Drawing.Color]::FromArgb(140, 140, 140)
}

function New-DotIcon {
    param([System.Drawing.Color]$Color)
    $bitmap = New-Object System.Drawing.Bitmap 16, 16
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $brush = New-Object System.Drawing.SolidBrush $Color
    $graphics.FillEllipse($brush, 1, 1, 13, 13)
    $brush.Dispose()
    $graphics.Dispose()
    $handle = $bitmap.GetHicon()
    $icon = [System.Drawing.Icon]::FromHandle($handle).Clone()
    [BrazCar.Native]::DestroyIcon($handle) | Out-Null
    $bitmap.Dispose()
    return $icon
}

$Icons = @{}
foreach ($name in $Colors.Keys) { $Icons[$name] = New-DotIcon $Colors[$name] }

$script:Failures = 0
$script:DownSince = ''
$script:PreviousKey = ''
$script:State = 'gray'

$tray = New-Object System.Windows.Forms.NotifyIcon
$tray.Icon = $Icons['gray']
$tray.Text = 'BrazCar: checando'
$tray.Visible = $true

function Invoke-Check {
    $reading = Get-ApiReading -Base $ApiBase
    if ($reading.Alive) { $script:Failures = 0 } else { $script:Failures++ }

    $now = Get-Date -Format 'HH:mm'
    if ($script:Failures -eq 1) { $script:DownSince = $now }

    $verdict = Resolve-WatchState -ApiAlive $reading.Alive -ConsecutiveFailures $script:Failures `
        -Importing $reading.Importing -Reason $reading.Reason

    if ($verdict.State -ne 'keep') {
        $key = $verdict.State + '|' + $reading.Reason
        $message = Resolve-Notification -PreviousKey $script:PreviousKey -Key $key -State $verdict.State `
            -Text $verdict.Text -Clock $now -DownSince $script:DownSince
        $script:PreviousKey = $key
        $script:State = $verdict.State
        $tray.Icon = $Icons[$verdict.State]
        if ($message) {
            $tipIcon = [System.Windows.Forms.ToolTipIcon]::Info
            if ($verdict.State -eq 'red' -or $verdict.State -eq 'yellow') { $tipIcon = [System.Windows.Forms.ToolTipIcon]::Warning }
            $tray.ShowBalloonTip(10000, 'BrazCar', $message, $tipIcon)
        }
    }
    # The time goes first: the tooltip holds 63 characters and a long reason would cut it off.
    $tray.Text = Limit-Text ('BrazCar ' + $now + ' · ' + $verdict.Text)
}

$menu = New-Object System.Windows.Forms.ContextMenuStrip
$checkNow = $menu.Items.Add('Checar agora')
$openBoard = $menu.Items.Add('Abrir mural')
$exit = $menu.Items.Add('Sair')
$checkNow.add_Click({ Invoke-Check })
$openBoard.add_Click({ Start-Process $BoardUrl })
$exit.add_Click({
        $timer.Stop()
        $tray.Visible = $false
        $tray.Dispose()
        [System.Windows.Forms.Application]::ExitThread()
    })
$tray.ContextMenuStrip = $menu

$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = [Math]::Max(1, $IntervalMinutes) * 60 * 1000
$timer.add_Tick({ Invoke-Check })
$timer.Start()

Invoke-Check
try {
    [System.Windows.Forms.Application]::Run()
}
finally {
    $tray.Visible = $false
    $tray.Dispose()
    $mutex.ReleaseMutex()
    $mutex.Dispose()
}
