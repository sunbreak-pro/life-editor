# 朝刊のタスク LifeEditor-Briefing を Task Scheduler に登録する（何度流しても同じ状態になる）。
#
# 使い方（管理者不要・現在のユーザーで実行）:
#   powershell -NoProfile -ExecutionPolicy Bypass -File .claude\automation\briefing\register-briefing.ps1
#   powershell -NoProfile -ExecutionPolicy Bypass -File .claude\automation\briefing\register-briefing.ps1 -At 05:30
#
# 毎日 05:30。スリープ中なら起こして走らせる（WakeToRun）。上限 10 分。逃した回は追わない
# （StartWhenAvailable を付けない。朝刊を昼に書いても意味が無いため）。電源が切れている日は朝刊が出ない。
# 起動役は main の checkout のものを指す。main の checkout で git pull して初めて、直した版が動く。
# 既存の 4 本のタスク（ClaudeHarness-Monthly / LifeEditor-Digest / LifeEditor-NightSafe / pdca-harness-run）には触らない。
#
# 編集するときは UTF-8 BOM を保つ。文字列リテラルは ASCII だけにする。

param(
  [string]$At = "05:30"
)

$ErrorActionPreference = "Stop"

$CommonDir = (& git -C $PSScriptRoot rev-parse --path-format=absolute --git-common-dir | Out-String).Trim()
$MainRoot = Split-Path $CommonDir -Parent
$Launcher = Join-Path $MainRoot ".claude\automation\briefing\run-briefing.ps1"
if (-not (Test-Path $Launcher)) {
  throw "Launcher not found in the main checkout: $Launcher (merge the briefing PR and pull main first)"
}
if (-not (Test-Path (Join-Path $env:LOCALAPPDATA "life-briefing\key.bin"))) {
  throw "key.bin not found. Run set-key.ps1 first."
}

$TaskName = "LifeEditor-Briefing"
$Principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited
$Settings = New-ScheduledTaskSettingsSet -WakeToRun -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 10) -MultipleInstances IgnoreNew
$Action = New-ScheduledTaskAction -Execute "powershell.exe" `
  -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$Launcher`"" `
  -WorkingDirectory (Split-Path $Launcher -Parent)
$Trigger = New-ScheduledTaskTrigger -Daily -At $At
Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings -Principal $Principal -Force | Out-Null

$Info = Get-ScheduledTaskInfo -TaskName $TaskName
Write-Output ("{0}: next run {1}, wake={2}" -f $TaskName, $Info.NextRunTime, (Get-ScheduledTask -TaskName $TaskName).Settings.WakeToRun)
