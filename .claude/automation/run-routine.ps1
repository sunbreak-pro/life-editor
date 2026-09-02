# Headless routine launcher (Loop Engineering Phase 1)
#
# 使い方（手動 / Task Scheduler 共通）:
#   powershell -NoProfile -ExecutionPolicy Bypass -File .claude\automation\run-routine.ps1 -Routine digest
#   powershell -NoProfile -ExecutionPolicy Bypass -File .claude\automation\run-routine.ps1 -Routine night-safe
#   powershell -NoProfile -ExecutionPolicy Bypass -File .claude\automation\run-routine.ps1 -Routine night
#
# -Routine <key> は .claude/automation/routine-<key>.md を読ませる。night = 夜の実装レーン
# （Phase 2・commit 止まり）。Task Scheduler への登録手順は routine-ids.md。
#
# ⚠️ 未実測（2026-09-01 時点）: Task Scheduler 登録の前に必ずコンソールで手動実行し、
#    ログ（.claude/automation/logs/）を見て権限まわりを調整すること。
#
# 権限は二層設計（親計画 §6）: acceptEdits でファイル書き込みを通し、外向きの操作
# （push / PR 作成 / Issue 書き込み）は無人専用の settings を --settings で渡して機械側で止める。
# 対話セッションの .claude/settings.json とは兼用しない — 2026-08-10 に対話側の permissions.ask から
# git push* / gh pr create* が外れているため（#618 / #619）、プロンプトの禁止文だけでは止まらない。

param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("digest", "night-safe", "night")]
  [string]$Routine
)

$ErrorActionPreference = "Stop"

# .claude/automation → リポジトリルート
$RepoRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
Set-Location $RepoRoot

# routine → 無人用 permissions プロファイル。
# readonly  = 書き込みは報告ファイルだけ（commit も禁止） … digest / night-safe
# implement = commit までは通し、push / PR / Issue 書き込みを止める … night
$ProfileMap = @{
  "digest"     = "settings-unattended-readonly.json"
  "night-safe" = "settings-unattended-readonly.json"
  "night"      = "settings-unattended-implement.json"
}

$SettingsFile = Join-Path $PSScriptRoot $ProfileMap[$Routine]
if (-not (Test-Path $SettingsFile)) {
  # 柵の無いまま無人実行しない (メッセージは ASCII 固定 — 日本語を文字列に入れると CP932 誤読で構文が壊れる)
  throw "Unattended settings not found: $SettingsFile"
}

$LogDir = Join-Path $PSScriptRoot "logs"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$Stamp = Get-Date -Format "yyyy-MM-dd_HHmm"
$LogFile = Join-Path $LogDir "$Routine-$Stamp.log"

$PromptFile = ".claude/automation/routine-$Routine.md"
$Bootstrap = "Read $PromptFile and execute its '## Prompt' section exactly. This is an unattended headless run."

# claude が stderr に 1 行でも書くと、Stop のままでは native command の stderr が
# error record 扱いになって起動直後に落ちる（ログが 0 バイトのまま残る）。
$ErrorActionPreference = "Continue"

# native コマンドの標準出力は [Console]::OutputEncoding で復号される。
# 日本語 Windows の既定（CP932）のままだと claude が返す UTF-8 の日本語が化けるので固定する。
$PrevOutEnc = [Console]::OutputEncoding
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)

$Raw = & claude -p $Bootstrap `
  --permission-mode acceptEdits `
  --settings $SettingsFile `
  --output-format json 2>&1
$ExitCode = $LASTEXITCODE
[Console]::OutputEncoding = $PrevOutEnc

# PowerShell 5.1 の > リダイレクトは UTF-16 で書くため、明示的に UTF-8 で保存する
$Text = ($Raw | Out-String)
[System.IO.File]::WriteAllText($LogFile, $Text, (New-Object System.Text.UTF8Encoding($false)))

# 報告の永続化は launcher の仕事。
# headless の claude は .claude/ 配下へ Write できない（allow ルールでも通らない = 2026-09-02 実測）ため、
# レーンには報告を最終メッセージとして出させ、その本文をここでファイルへ追記する。
$ReportMap = @{
  "digest"     = "comm/digest/$(Get-Date -Format 'yyyy-MM-dd').md"
  "night-safe" = "comm/outbox/chat-night-safe/night-safe-report.md"
  "night"      = "comm/outbox/chat-night/night-report.md"
}
$ReportPath = Join-Path $RepoRoot (".claude/" + $ReportMap[$Routine])

# stderr は 2>&1 で ErrorRecord として混ざるので、JSON のパースには文字列行だけを使う
$JsonText = (($Raw | Where-Object { $_ -is [string] }) -join "`n").Trim()
$Brace = $JsonText.IndexOf("{")
if ($Brace -gt 0) { $JsonText = $JsonText.Substring($Brace) }

try {
  $Body = ($JsonText | ConvertFrom-Json).result
} catch {
  $Body = $null
}

if ([string]::IsNullOrWhiteSpace($Body)) {
  Write-Warning "no report body in the claude output; see $LogFile"
} else {
  New-Item -ItemType Directory -Force -Path (Split-Path $ReportPath -Parent) | Out-Null
  $Header = "`n<!-- run: $Routine / $(Get-Date -Format 'yyyy-MM-dd HH:mm') / log: $(Split-Path $LogFile -Leaf) -->`n"
  [System.IO.File]::AppendAllText($ReportPath, $Header + $Body + "`n", (New-Object System.Text.UTF8Encoding($false)))
  Write-Output "report appended: $ReportPath"
}

exit $ExitCode
