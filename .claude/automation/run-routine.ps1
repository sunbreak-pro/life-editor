# Headless routine launcher (Loop Engineering Phase 1)
#
# 使い方（手動 / Task Scheduler 共通）:
#   powershell -NoProfile -ExecutionPolicy Bypass -File .claude\automation\run-routine.ps1 -Routine digest
#   powershell -NoProfile -ExecutionPolicy Bypass -File .claude\automation\run-routine.ps1 -Routine night-safe
#   powershell -NoProfile -ExecutionPolicy Bypass -File .claude\automation\run-routine.ps1 -Routine night
#
# -Routine <key> は .claude/automation/routine-<key>.md を読ませる。night = 夜の実装レーン
# （Phase 2・未登録）。Task Scheduler への登録は register-routines.ps1（台帳 = routine-ids.md）。
#
# 実行の流れ（2026-09-26 改訂 — 報告を PR で届ける形へ）:
#   1. origin を fetch し、レーン専用の worktree（リポジトリの外 = workspaces/life-editor/routine*）を
#      origin の最新に合わせる。メインのチェックアウト（chat-main 専有）には触らない。
#   2. その worktree で claude -p を走らせる。
#   3. 最終メッセージを当日の報告ファイル（.claude/automation/reports/YYYY-MM-DD.md）へ追記し、
#      launcher が commit → push → 日次の報告 PR を作成 / 本文を更新する。
#      night が commit を残したときは、その実装ブランチも launcher が push して draft PR にする。
#
# 権限は二層設計（親計画 §6）: claude 自身には push / PR 作成を許さない（無人専用の settings を
# --settings で渡して機械側で止める）。push と PR 作成は、この決定論的なスクリプトだけが行う。
# merge は常にこうだいさん（POLICY P-001）。
#
# 編集するときは UTF-8 BOM を保つ（routine-ids.md の注意書き）。文字列リテラルは ASCII だけにする。

param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("digest", "night-safe", "night")]
  [string]$Routine
)

$ErrorActionPreference = "Stop"

# routine → 無人用 permissions プロファイル。
# readonly  = 書き込みなし（commit も禁止） … digest / night-safe
# implement = commit までは通し、push / PR / Issue 書き込みを止める … night
$ProfileMap = @{
  "digest"     = "settings-unattended-readonly.json"
  "night-safe" = "settings-unattended-readonly.json"
  "night"      = "settings-unattended-implement.json"
}

$SettingsFile = Join-Path $PSScriptRoot $ProfileMap[$Routine]
if (-not (Test-Path $SettingsFile)) {
  # 柵の無いまま無人実行しない
  throw "Unattended settings not found: $SettingsFile"
}

# claude / git が stderr に 1 行でも書くと、Stop のままでは native command の stderr が
# error record 扱いになって落ちる。ここから先は終了コードを明示的に見る。
$ErrorActionPreference = "Continue"

# メインのチェックアウト = git の共通ディレクトリの親。worktree から起動しても同じ場所を指す。
$CommonDir = (& git -C $PSScriptRoot rev-parse --path-format=absolute --git-common-dir | Out-String).Trim()
$MainRoot = Split-Path $CommonDir -Parent
# worktree の置き場所 = <repos-parent>/workspaces/life-editor/<slug>（worktree-policy スキル）
$WorkspaceDir = Join-Path (Split-Path $MainRoot -Parent) "workspaces\life-editor"
$ReportTree = Join-Path $WorkspaceDir "routine"
$NightTree = Join-Path $WorkspaceDir "routine-night"

$LogDir = Join-Path $PSScriptRoot "logs"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$Stamp = Get-Date -Format "yyyy-MM-dd_HHmm"
$LogFile = Join-Path $LogDir "$Routine-$Stamp.log"
$RunLedger = Join-Path $LogDir "runs.log"

$Today = Get-Date -Format "yyyy-MM-dd"
$DayBranch = "chore/routine-report-" + (Get-Date -Format "yyyyMMdd")
$ReportRel = ".claude/automation/reports/$Today.md"
$Utf8 = New-Object System.Text.UTF8Encoding($false)

# 1 回 1 行の実行台帳（logs/ は git 非追跡）。来なかった回・失敗した回をあとから数えるため。
function Write-Ledger([string]$Line) {
  [System.IO.File]::AppendAllText($RunLedger, "$(Get-Date -Format 'yyyy-MM-dd HH:mm')`t$Routine`t$Line`n", $Utf8)
}

function Invoke-Git([string]$Dir, [string[]]$GitArgs) {
  $Out = & git -C $Dir @GitArgs 2>&1 | Out-String
  if ($LASTEXITCODE -ne 0) {
    throw "git $($GitArgs -join ' ') failed in ${Dir}: $Out"
  }
  return $Out
}

# push に失敗した日次ブランチの印。次の回はこの印を見て、ローカルの commit から続ける。
function Get-PendingMarker([string]$Branch) {
  return (Join-Path $LogDir ("pending-push-" + ($Branch -replace '/', '_')))
}

# レーン専用 worktree を用意し、指定の起点へ合わせる。
# 使い捨ての作業場なので、残っている変更は捨てる。ただし同じ置き場には Orca などが作った
# 作業用 worktree も並ぶので、launcher が作った印（.session-name）が無いものには触らない。
function Reset-Worktree([string]$Dir, [string]$Branch, [string]$SessionName) {
  $NameFile = Join-Path $Dir ".claude/comm/.session-name"
  if (Test-Path $Dir) {
    $Owner = ""
    if (Test-Path $NameFile) { $Owner = ([System.IO.File]::ReadAllText($NameFile)).Trim() }
    if ($Owner -ne $SessionName) {
      throw "Refusing to reset $Dir (session-name is '$Owner', expected '$SessionName')"
    }
  } else {
    Invoke-Git $MainRoot @("worktree", "add", "--detach", $Dir, "origin/main") | Out-Null
  }
  Invoke-Git $Dir @("reset", "--hard", "-q") | Out-Null
  Invoke-Git $Dir @("clean", "-fdq") | Out-Null
  if ($Branch) {
    & git -C $Dir rev-parse --verify -q "refs/remotes/origin/$Branch" *> $null
    if ($LASTEXITCODE -eq 0) { $Base = "origin/$Branch" } else { $Base = "origin/main" }
    if (Test-Path (Get-PendingMarker $Branch)) { $Base = $Branch }
    Invoke-Git $Dir @("checkout", "-q", "-B", $Branch, $Base) | Out-Null
    $SessionBranch = $Branch
  } else {
    Invoke-Git $Dir @("checkout", "-q", "--detach", "origin/main") | Out-Null
    $SessionBranch = "detached"
  }
  # worktree-policy: .session-branch / .session-name が無いと hook が無音スキップする
  [System.IO.File]::WriteAllText((Join-Path $Dir ".claude/comm/.session-branch"), "$SessionBranch`n", $Utf8)
  [System.IO.File]::WriteAllText((Join-Path $Dir ".claude/comm/.session-name"), "$SessionName`n", $Utf8)
}

# 当日の報告ファイルへ 1 節を足し、日次の報告 PR へ届ける。戻り値は PR 番号か失敗理由。
function Publish-Report([string]$Section) {
  Reset-Worktree $ReportTree $DayBranch "chat-routine"
  $Path = Join-Path $ReportTree $ReportRel
  New-Item -ItemType Directory -Force -Path (Split-Path $Path -Parent) | Out-Null
  if (-not (Test-Path $Path)) {
    [System.IO.File]::WriteAllText($Path, "# Routine report $Today`n", $Utf8)
  }
  [System.IO.File]::AppendAllText($Path, "`n$Section`n", $Utf8)

  Invoke-Git $ReportTree @("add", "--", $ReportRel) | Out-Null
  Invoke-Git $ReportTree @("commit", "-q", "-m", "chore(routine): add the $Routine report for $Today") | Out-Null
  $Marker = Get-PendingMarker $DayBranch
  $PushOut = & git -C $ReportTree push -q -u origin $DayBranch 2>&1 | Out-String
  if ($LASTEXITCODE -ne 0) {
    [System.IO.File]::WriteAllText($Marker, "$Today`n", $Utf8)
    return "push failed (kept locally): $($PushOut -replace '\s+', ' ')"
  }
  if (Test-Path $Marker) { Remove-Item $Marker -Force }

  Push-Location $ReportTree
  try {
    $Pr = (& gh pr list --head $DayBranch --state open --json number --jq '.[0].number' 2>$null | Out-String).Trim()
    if ($Pr -and $Pr -ne "null") {
      & gh pr edit $Pr --body-file $Path *> $null
      if ($LASTEXITCODE -ne 0) { return "#$Pr (body update failed)" }
    } else {
      $Url = (& gh pr create --base main --head $DayBranch --title "chore(routine): daily routine report $Today" --body-file $Path 2>&1 | Out-String).Trim()
      if ($LASTEXITCODE -ne 0) { return "pr create failed: $($Url -replace '\s+', ' ')" }
      $Pr = ($Url -split "/")[-1]
    }
  } finally {
    Pop-Location
  }
  return "#$Pr"
}

# 同時に 2 本走ると同じ worktree を取り合うので、レーンをまたいで 1 本ずつにする。
$Mutex = New-Object System.Threading.Mutex($false, "LifeEditorRoutineRunner")
try {
  # タスクの上限は 1 時間なので、待つのは 20 分まで（残り 40 分を実行に回す）
  $Owned = $Mutex.WaitOne([TimeSpan]::FromMinutes(20))
} catch [System.Threading.AbandonedMutexException] {
  $Owned = $true
}
if (-not $Owned) {
  Write-Ledger "skipped: another routine held the lock for 20 min"
  exit 1
}

# native コマンドの標準出力は [Console]::OutputEncoding で復号される。
# 日本語 Windows の既定（CP932）のままだと claude と git が返す UTF-8 の日本語が化けるので、
# 終了（Stop-Run）まで UTF-8 に固定する。
$PrevOutEnc = [Console]::OutputEncoding
[Console]::OutputEncoding = $Utf8

# スリープ復帰（WakeToRun）で起きた PC は、入力が無いと数分で寝直す。
# 走っている間だけ「システムを起こしておく」要求を出す（ES_CONTINUOUS | ES_SYSTEM_REQUIRED）。
Add-Type -Namespace LifeEditor -Name Power -MemberDefinition '[DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint esFlags);'
[void][LifeEditor.Power]::SetThreadExecutionState([uint32]2147483649)

function Stop-Run([int]$Code) {
  [Console]::OutputEncoding = $PrevOutEnc
  [void][LifeEditor.Power]::SetThreadExecutionState([uint32]2147483648)
  $Mutex.ReleaseMutex()
  exit $Code
}

try {
  # スリープ復帰の直後はネットワークの再接続が間に合わないことがあるので、30 秒おきに 4 回まで試す
  for ($Try = 1; $Try -le 4; $Try++) {
    & git -C $MainRoot fetch -q --prune origin *> $null
    if ($LASTEXITCODE -eq 0) { break }
    if ($Try -eq 4) { throw "git fetch failed 4 times" }
    Start-Sleep -Seconds 30
  }
  if ($Routine -eq "night") {
    $RunTree = $NightTree
    Reset-Worktree $NightTree $null "chat-night"
  } else {
    $RunTree = $ReportTree
    Reset-Worktree $ReportTree $DayBranch "chat-routine"
  }
  # dev-digest は前回 digest の mtime と outbox を比べる。digest の控えは git 非追跡なので、
  # メインのチェックアウトから直近 3 本を worktree へ写す（Copy-Item は更新日時を保つ）
  if ($Routine -eq "digest") {
    $SrcDigest = Join-Path $MainRoot ".claude/comm/digest"
    $DstDigest = Join-Path $ReportTree ".claude/comm/digest"
    if (Test-Path $SrcDigest) {
      New-Item -ItemType Directory -Force -Path $DstDigest | Out-Null
      Get-ChildItem $SrcDigest -Filter *.md | Sort-Object LastWriteTime -Descending |
        Select-Object -First 3 | Copy-Item -Destination $DstDigest -Force
    }
  }
} catch {
  Write-Ledger "setup failed: $($_.Exception.Message -replace '\s+', ' ')"
  Stop-Run 1
}

$PromptFile = ".claude/automation/routine-$Routine.md"
$Bootstrap = "Read $PromptFile and execute its '## Prompt' section exactly. This is an unattended headless run."

Set-Location $RunTree
# claude が起動できなかったとき、直前の git の終了コード 0 を拾わないよう番兵を置く
$global:LASTEXITCODE = -1
$Raw = & claude -p $Bootstrap `
  --permission-mode acceptEdits `
  --settings $SettingsFile `
  --output-format json 2>&1
$ExitCode = $LASTEXITCODE
if ($ExitCode -eq -1) { $ExitCode = 127 }

# PowerShell 5.1 の > リダイレクトは UTF-16 で書くため、明示的に UTF-8 で保存する
[System.IO.File]::WriteAllText($LogFile, ($Raw | Out-String), $Utf8)

# stderr は 2>&1 で ErrorRecord として混ざるので、JSON のパースには文字列行だけを使う
$JsonText = (($Raw | Where-Object { $_ -is [string] }) -join "`n").Trim()
$Brace = $JsonText.IndexOf("{")
if ($Brace -gt 0) { $JsonText = $JsonText.Substring($Brace) }
try {
  $Body = ($JsonText | ConvertFrom-Json).result
} catch {
  $Body = $null
}

$LogName = Split-Path $LogFile -Leaf
$Time = Get-Date -Format "HH:mm"
$NightPr = ""

# night が commit を残していれば、実装ブランチを push して draft PR にする（本文 = 報告）。
if ($Routine -eq "night" -and -not [string]::IsNullOrWhiteSpace($Body)) {
  $NightBranch = (& git -C $NightTree branch --show-current | Out-String).Trim()
  $Ahead = (& git -C $NightTree rev-list --count origin/main..HEAD | Out-String).Trim()
  # CI 定義と自分の動かし方を書き換えた commit は push しない（push すると secrets 付きで走りうる）
  $Protected = @(& git -C $NightTree diff --name-only origin/main..HEAD | Where-Object { $_ -match '^(\.github/|\.claude/(automation|settings))' })
  if ($NightBranch -and $Ahead -ne "0" -and $Protected.Count -gt 0) {
    $NightPr = "not pushed: $NightBranch touches protected paths ($($Protected -join ', '))"
  } elseif ($NightBranch -and $Ahead -ne "0") {
    $BodyFile = Join-Path $LogDir "night-pr-body-$Stamp.md"
    [System.IO.File]::WriteAllText($BodyFile, $Body, $Utf8)
    & git -C $NightTree push -q -u origin $NightBranch *> $null
    if ($LASTEXITCODE -eq 0) {
      $Subject = (& git -C $NightTree log -1 --format=%s | Out-String).Trim()
      Push-Location $NightTree
      $NightUrl = (& gh pr create --draft --base main --head $NightBranch --title $Subject --body-file $BodyFile 2>&1 | Out-String).Trim()
      $GhExit = $LASTEXITCODE
      Pop-Location
      if ($GhExit -eq 0) { $NightPr = "draft PR: $NightUrl" } else { $NightPr = "pushed $NightBranch, but draft PR creation failed: $($NightUrl -replace '\s+', ' ')" }
    } else {
      $NightPr = "push of $NightBranch failed"
    }
  }
}

if ([string]::IsNullOrWhiteSpace($Body)) {
  # 黙って消えないよう、失敗も報告 PR に 1 節として載せる
  $Section = "## $Routine / $Today $Time / FAILED`n`nNo report body in the claude output (exit code $ExitCode). Log: ``.claude/automation/logs/$LogName`` on the runner machine."
} else {
  $Section = "## $Routine / $Today $Time`n`n<!-- log: $LogName / exit code: $ExitCode -->`n"
  if ($NightPr) { $Section += "`n- $NightPr`n" }
  $Section += "`n$Body"
}

try {
  $Result = Publish-Report $Section
} catch {
  $Result = "publish failed: $($_.Exception.Message -replace '\s+', ' ')"
}

# digest は従来どおりメインのチェックアウトにも控えを置く（.claude/comm/digest/ は git 非追跡）
if ($Routine -eq "digest" -and -not [string]::IsNullOrWhiteSpace($Body)) {
  $DigestCopy = Join-Path $MainRoot ".claude/comm/digest/$Today.md"
  New-Item -ItemType Directory -Force -Path (Split-Path $DigestCopy -Parent) | Out-Null
  [System.IO.File]::AppendAllText($DigestCopy, "`n<!-- run: $Routine / $Today $Time / log: $LogName -->`n$Body`n", $Utf8)
}

$ReportState = if ([string]::IsNullOrWhiteSpace($Body)) { "missing" } else { "ok" }
Write-Ledger "exit=$ExitCode`treport=$ReportState`t$Result"
Write-Output "report: $Result"
# claude が成功しても報告が PR に届かなければ、Task Scheduler の結果にも失敗として出す
if ($ExitCode -eq 0 -and -not $Result.StartsWith("#")) { $ExitCode = 2 }
Stop-Run $ExitCode
