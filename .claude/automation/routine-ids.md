# Routine Registry（定期実行の登録台帳）

> 何が・どの基盤で・いつ動くかの台帳。登録 / 変更 / 削除をしたら必ず本ファイルを更新すること。
> 旧 Cloud Routine（`trig_` 台帳）は 2026-08-04 の Phase 1 改訂で退役（親計画 Non-goals）。旧内容は git 履歴を参照。

---

## Registered Routines

| Routine    | 基盤                   | Schedule       | Task 名                | Status     | Registered |
| ---------- | ---------------------- | -------------- | ---------------------- | ---------- | ---------- |
| night-safe | Windows Task Scheduler | 毎日 07:13 JST（スリープ解除） | `LifeEditor-NightSafe` | **ACTIVE** | 2026-09-02（2026-09-26 再登録） |
| digest | Windows Task Scheduler | 毎日 07:43 JST（スリープ解除） | `LifeEditor-Digest` | **ACTIVE** | 2026-09-02（2026-09-26 再登録） |

- 夜中ではなく朝に PC を起こす（2026-09-26 ユーザー決定）。監査を先に走らせ、30 分後の digest がその報告を読む順にしている
- 発火時刻を 00 分 / 30 分から外しているのは意図的（ジャストの時刻は負荷が集中しやすい・数分の前後はこの用途で問題にならない）
- 報告は当日の `reports/YYYY-MM-DD.md` に launcher が追記し、日次の報告 PR（`chore/routine-report-YYYYMMDD`）で届く
- Status 遷移: PENDING（裁定待ち）→ ACTIVE（登録済み）→ PAUSED / RETIRED

## 登録手順（再登録 / 時刻変更 / 別マシンへの移設）

`register-routines.ps1` を流す（管理者不要・現在のユーザーで実行・何度流しても同じ状態になる）。時刻を変えるときはスクリプト内の表と上の台帳を両方直す。

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:\Users\user\orca\life-editor\.claude\automation\register-routines.ps1
```

スクリプトが設定するもの:

- **スリープ解除（WakeToRun）**: `schtasks /Create` では指定できないので `Register-ScheduledTask` を使う。2026-09-02〜25 は未設定だったため、06:03 の digest は 24 日中 22 日が発火しなかった
- **電源プランの「スリープ解除タイマーの許可」（AC）**: 無効だと WakeToRun が効かない。`powercfg` で有効にできなければ警告が出るので、コントロールパネルの電源オプションから手で有効にする
- **実行時間の上限 1 時間**（旧 72 時間は、1 回固まると最長 3 日分を黙って捨てていた）・逃した回を次の起動で追う（StartWhenAvailable）・窓を出さない（`-WindowStyle Hidden`）
- タスクはメインのチェックアウトの `run-routine.ps1` を指す。launcher の変更は main に merge し、メインで `git pull` してから効く

**起動前の動作確認**は、コンソールで launcher を 1 回手動実行して `logs/runs.log` の最終行と報告 PR を見る:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:\Users\user\orca\life-editor\.claude\automation\run-routine.ps1 -Routine night-safe
```

無人用 permissions は `run-routine.ps1` が routine ごとに選んで `--settings` で渡す（digest / night-safe = `settings-unattended-readonly.json`、night = `settings-unattended-implement.json`）。ファイルが無ければスクリプトは起動せずに止まる（柵の無い無人実行を作らないため）。

> **`run-routine.ps1` / `register-routines.ps1` を編集するときは UTF-8 BOM を保つ。** Windows PowerShell 5.1 は BOM なしを CP932 として読むため、日本語コメントの末尾バイトが改行を飲み込み、次の行がコメントに埋もれる（実際 `$RepoRoot = Split-Path ...` が消えて `Set-Location` が null で落ちていた）。文字列リテラルに日本語を入れないのも同じ理由（閉じ引用符が飲まれる）。

登録内容の確認は `Get-ScheduledTaskInfo -TaskName LifeEditor-Digest` の `NextRunTime` と、`(Get-ScheduledTask -TaskName LifeEditor-Digest).Settings.WakeToRun` を見る。

**既知の制約**: タスクは「ログオンしているときのみ実行」のまま（「ログオンしていなくても実行」にすると保存済みの認証情報を読めず `claude -p` が無音で失敗する報告がある = anthropics/claude-code#96932 のコメント）。再起動後にログオンしていない朝は発火しない。

## 一時停止 / 削除

```powershell
schtasks /Change /TN "LifeEditor-Digest" /DISABLE   # 一時停止
schtasks /Change /TN "LifeEditor-Digest" /ENABLE    # 再開
schtasks /Delete /TN "LifeEditor-Digest" /F         # 削除
```

## セッション内 CronCreate を使う場合の注意

Claude Code セッション内の scheduled tasks（CronCreate）は**そのセッション限定**（閉じたら消える）で、繰り返しジョブは **7 日で自動期限切れ**（2026-08-04 実測）。常駐セッション運用をしない限り定期実行の基盤にはならない。臨時で使った場合もここに 1 行記録する（期限切れの追跡のため）。

## 既存の定期実行（干渉防止の参考）

| Name                    | 基盤              | Schedule       | 用途                       |
| ----------------------- | ----------------- | -------------- | -------------------------- |
| weekly-history-learning | Cloud（Mac 時代） | 毎朝 07:03 JST | 歴史学習配信               |
| commute-mobile-dev      | Cloud（Mac 時代） | 17:55 JST 平日 | 帰宅時 mobile 開発 routine |

→ 07:13 / 07:43 は既存の 07:03（Mac 時代の Cloud 配信・この PC の電源とは無関係）と 10 分以上離している

---

## 履歴

- 2026-05-26: 台帳初期化（Cloud Routine 前提・Night = PENDING / Morning = DEFERRED のまま未稼働）
- 2026-08-04: Phase 1 改訂で全面書き換え（Cloud Routine 台帳を退役・Task Scheduler 案 + headless launcher へ。発火は D-20260804-main-1 裁定待ち）
- 2026-09-02: 2 本を `schtasks` へ登録して ACTIVE 化（#1335）。事前ゲートの手動実走 = `logs/night-safe-2026-09-02_2100.log`（3 分で完走・報告は launcher が `comm/outbox/chat-night-safe/` へ自動追記）
- 2026-09-26: `register-routines.ps1` で再登録。スリープ解除つきで朝 07:13（night-safe）/ 07:43（digest）へ移し、報告の届け先を日次の報告 PR に変えた（旧 `comm/outbox/chat-night-safe/night-safe-report.md` への追記は廃止）
