# API キーを暗号化して %LOCALAPPDATA%\life-briefing\key.bin にしまう（しまい直すときに使う）。
#
# 使い方:
#   powershell -NoProfile -ExecutionPolicy Bypass -File .claude\automation\briefing\set-key.ps1
#
# キーは画面に出ない入力欄で受け取る。会話にも Claude Code にも渡さない。
# 暗号化は Windows の DPAPI（このユーザーでログインしているときだけ復号できる）。
# 形式は ConvertFrom-SecureString の出力（16 進数の文字列）で、run-briefing.ps1 が ConvertTo-SecureString で戻す。
#
# 編集するときは UTF-8 BOM を保つ。文字列リテラルは ASCII だけにする。

$ErrorActionPreference = "Stop"

$Dir = Join-Path $env:LOCALAPPDATA "life-briefing"
$KeyFile = Join-Path $Dir "key.bin"
New-Item -ItemType Directory -Force -Path $Dir | Out-Null

$Secure = Read-Host -Prompt "Anthropic API key (input is hidden)" -AsSecureString
if ($Secure.Length -lt 20) {
  throw "The key is too short. Nothing was written."
}

$Encrypted = ConvertFrom-SecureString -SecureString $Secure
# BOM なしの ASCII で書く（Set-Content の既定の符号化は版で違うため明示する）
[System.IO.File]::WriteAllText($KeyFile, $Encrypted, (New-Object System.Text.ASCIIEncoding))
Write-Output ("Saved: {0} ({1} bytes)" -f $KeyFile, (Get-Item $KeyFile).Length)
