# Task Scheduler registration for the headless routines (Loop Engineering Phase 1)
#
# 使い方（管理者不要・現在のユーザーで実行。何度流しても同じ状態になる）:
#   powershell -NoProfile -ExecutionPolicy Bypass -File .claude\automation\register-routines.ps1
#
# schtasks /Create では「スリープを解除して実行する」(WakeToRun) を指定できないため、
# Register-ScheduledTask で登録する（2026-09-26 — 06:03 の digest が 24 日中 22 日スリープで
# 発火していなかった実測を受けて切り替え）。時刻は夜中を避け、朝に PC を起こす。
# 台帳 = routine-ids.md。時刻を変えたら台帳も直す。
#
# 編集するときは UTF-8 BOM を保つ。文字列リテラルは ASCII だけにする。

$ErrorActionPreference = "Stop"

# タスクはワークツリーではなくメインのチェックアウトの launcher を指す（worktree から流しても同じ）
$CommonDir = (& git -C $PSScriptRoot rev-parse --path-format=absolute --git-common-dir | Out-String).Trim()
$MainRoot = Split-Path $CommonDir -Parent
$Launcher = Join-Path $MainRoot ".claude\automation\run-routine.ps1"

# 監査（night-safe）を先に走らせ、30 分後の digest がその報告を読めるようにする
$Routines = @(
  @{ Task = "LifeEditor-NightSafe"; Routine = "night-safe"; At = "07:13" },
  @{ Task = "LifeEditor-Digest"; Routine = "digest"; At = "07:43" }
)

$Principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited
# WakeToRun = スリープ中なら起こして走らせる。StartWhenAvailable = 電源断などで逃した回を次の起動で追う。
# 上限 1 時間（旧 72 時間は、1 回固まると最長 3 日分を黙って捨てていた）。
$Settings = New-ScheduledTaskSettingsSet -WakeToRun -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -ExecutionTimeLimit (New-TimeSpan -Hours 1) -MultipleInstances IgnoreNew

foreach ($R in $Routines) {
  $Action = New-ScheduledTaskAction -Execute "powershell.exe" `
    -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$Launcher`" -Routine $($R.Routine)" `
    -WorkingDirectory $MainRoot
  $Trigger = New-ScheduledTaskTrigger -Daily -At $R.At
  Register-ScheduledTask -TaskName $R.Task -Action $Action -Trigger $Trigger -Settings $Settings -Principal $Principal -Force | Out-Null
  $Info = Get-ScheduledTaskInfo -TaskName $R.Task
  Write-Output ("{0}: next run {1}, wake={2}" -f $R.Task, $Info.NextRunTime, (Get-ScheduledTask -TaskName $R.Task).Settings.WakeToRun)
}

# 電源プランの「スリープ解除タイマーの許可」(AC) が無効だと WakeToRun が効かない
$ErrorActionPreference = "Continue"
& powercfg /setacvalueindex SCHEME_CURRENT SUB_SLEEP RTCWAKE 1 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
  & powercfg /setactive SCHEME_CURRENT 2>&1 | Out-Null
  Write-Output "wake timers (AC): enabled"
} else {
  Write-Warning "Could not enable wake timers for AC. Turn on 'Allow wake timers' in Power Options manually."
}
