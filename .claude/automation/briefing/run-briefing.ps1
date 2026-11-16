# 朝刊の起動役。鍵を復号して、node のプロセスの環境にだけ渡し、終わったら消す。
#
# 使い方（手動 / Task Scheduler 共通）:
#   powershell -NoProfile -ExecutionPolicy Bypass -File .claude\automation\briefing\run-briefing.ps1
#   powershell -NoProfile -ExecutionPolicy Bypass -File .claude\automation\briefing\run-briefing.ps1 -DryRun -Date 2026-11-14
#
# 鍵は %LOCALAPPDATA%\life-briefing\key.bin（DPAPI）。ユーザー環境変数 ANTHROPIC_API_KEY には置かない。
# 常設すると、対話型の Claude Code と、ほかの無人の実行までが API 払いになるため。
# 結果と費用は briefing.mjs が logs\briefing.log に 1 行で書く。このスクリプトは logs\runs.log に終了コードを足す。
#
# 編集するときは UTF-8 BOM を保つ。文字列リテラルは ASCII だけにする。

param(
  [switch]$DryRun,
  [string]$Date
)

$ErrorActionPreference = "Stop"

# 日本語の文字化けを避けるため、入出力を UTF-8 に固定する
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
$env:NODE_OPTIONS = ""

$AppHome = Join-Path $env:LOCALAPPDATA "life-briefing"
$KeyFile = Join-Path $AppHome "key.bin"
$LogDir = Join-Path $AppHome "logs"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$RunLedger = Join-Path $LogDir "runs.log"
$Utf8 = New-Object System.Text.UTF8Encoding($false)

function Write-Ledger([string]$Line) {
  [System.IO.File]::AppendAllText($RunLedger, "$(Get-Date -Format 'yyyy-MM-dd HH:mm')`t$Line`n", $Utf8)
}

if (-not (Test-Path $KeyFile)) {
  Write-Ledger "no-key"
  throw "Key file not found: $KeyFile (run set-key.ps1)"
}

$Node = (Get-Command node -ErrorAction Stop).Source
$Npm = (Get-Command npm.cmd -ErrorAction Stop).Source
Set-Location $PSScriptRoot

# 依存（@anthropic-ai/sdk）が無い checkout では入れる。lockfile のとおりに入る
if (-not (Test-Path (Join-Path $PSScriptRoot "node_modules"))) {
  $ErrorActionPreference = "Continue"
  & $Npm ci --ignore-scripts --no-audit --no-fund 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) {
    Write-Ledger "npm-ci-failed"
    throw "npm ci failed"
  }
}

$ErrorActionPreference = "Stop"
$Bstr = [IntPtr]::Zero
$Plain = $null
$Code = 1
try {
  $Secure = ConvertTo-SecureString (Get-Content -Path $KeyFile -Raw).Trim()
  $Bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($Secure)
  $Plain = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($Bstr)
  # このプロセスの環境にだけ置く。子の node が引き継ぐ。ユーザー環境変数には書かない
  $env:ANTHROPIC_API_KEY = $Plain

  $NodeArgs = @("briefing.mjs")
  if ($DryRun) { $NodeArgs += "--dry-run" }
  if ($Date) { $NodeArgs += @("--date", $Date) }

  # 標準出力と標準エラーを 1 つにして受け、鍵の値が混ざっていれば伏せてから出す
  $ErrorActionPreference = "Continue"
  $Out = & $Node @NodeArgs 2>&1 | Out-String
  $Code = $LASTEXITCODE
  $ErrorActionPreference = "Stop"
  if ($Plain) { $Out = $Out.Replace($Plain, "[redacted]") }
  Write-Output $Out
}
finally {
  Remove-Item Env:\ANTHROPIC_API_KEY -ErrorAction SilentlyContinue
  if ($Bstr -ne [IntPtr]::Zero) { [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($Bstr) }
  $Plain = $null
  Write-Ledger ("exit={0}{1}" -f $Code, $(if ($DryRun) { " dry-run" } else { "" }))
}
exit $Code
