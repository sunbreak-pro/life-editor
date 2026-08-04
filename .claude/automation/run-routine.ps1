# Headless routine launcher (Loop Engineering Phase 1)
#
# 使い方（手動 / Task Scheduler 共通）:
#   powershell -NoProfile -ExecutionPolicy Bypass -File .claude\automation\run-routine.ps1 -Routine digest
#   powershell -NoProfile -ExecutionPolicy Bypass -File .claude\automation\run-routine.ps1 -Routine night-safe
#
# ⚠️ 未実測（2026-08-04 配置時点）: Task Scheduler 登録の前に必ずコンソールで手動実行し、
#    ログ（.claude/automation/logs/）を見て権限まわりを調整すること。登録手順 = routine-ids.md。
#
# 権限は二層設計（親計画 §6）: acceptEdits でファイル書き込みを通し、push / PR 作成は
# .claude/settings.json の permissions.ask が常に確認を要求する（headless では確認できず
# 失敗する → ルーチンは outbox 報告へ degrade する設計）。deny list（main 保護）は据え置き。

param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("digest", "night-safe")]
  [string]$Routine
)

$ErrorActionPreference = "Stop"

# .claude/automation → リポジトリルート
$RepoRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
Set-Location $RepoRoot

$LogDir = Join-Path $PSScriptRoot "logs"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$Stamp = Get-Date -Format "yyyy-MM-dd_HHmm"
$LogFile = Join-Path $LogDir "$Routine-$Stamp.log"

$PromptFile = ".claude/automation/routine-$Routine.md"
$Bootstrap = "Read $PromptFile and execute its '## Prompt' section exactly. This is an unattended headless run."

& claude -p $Bootstrap `
  --permission-mode acceptEdits `
  --output-format json `
  *> $LogFile

exit $LASTEXITCODE
