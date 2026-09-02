# Routine Registry（定期実行の登録台帳）

> 何が・どの基盤で・いつ動くかの台帳。登録 / 変更 / 削除をしたら必ず本ファイルを更新すること。
> 旧 Cloud Routine（`trig_` 台帳）は 2026-08-04 の Phase 1 改訂で退役（親計画 Non-goals）。旧内容は git 履歴を参照。

---

## Registered Routines

| Routine    | 基盤                      | Schedule       | Task 名（予定）        | Status                           | Registered |
| ---------- | ------------------------- | -------------- | ---------------------- | -------------------------------- | ---------- |
| digest     | Windows Task Scheduler 案 | 毎日 06:03 JST | `LifeEditor-Digest`    | **PENDING**（D-20260804-main-1） | —          |
| night-safe | Windows Task Scheduler 案 | 毎日 22:33 JST | `LifeEditor-NightSafe` | **PENDING**（D-20260804-main-1） | —          |

- 発火時刻を 00 分 / 30 分から外しているのは意図的（ジャストの時刻は負荷が集中しやすい・数分の前後はこの用途で問題にならない）
- Status 遷移: PENDING（裁定待ち）→ ACTIVE（登録済み）→ PAUSED / RETIRED

## 登録手順（Task Scheduler 案が裁定されたら・ユーザー実行）

**登録前に必ず 1 回、コンソールで手動実行して動作確認する**（起動経路は 2026-09-01 に実測済み。推論を伴う実走はまだ）:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:\Users\user\orca\life-editor\.claude\automation\run-routine.ps1 -Routine night-safe
```

無人用 permissions は `run-routine.ps1` が routine ごとに選んで `--settings` で渡す（digest / night-safe = `settings-unattended-readonly.json`、night = `settings-unattended-implement.json`）。ファイルが無ければスクリプトは起動せずに止まる（柵の無い無人実行を作らないため）。

> **`run-routine.ps1` を編集するときは UTF-8 BOM を保つ。** Windows PowerShell 5.1 は BOM なしを CP932 として読むため、日本語コメントの末尾バイトが改行を飲み込み、次の行がコメントに埋もれる（実際 `$RepoRoot = Split-Path ...` が消えて `Set-Location` が null で落ちていた）。文字列リテラルに日本語を入れないのも同じ理由（閉じ引用符が飲まれる）。

問題なければ登録（管理者不要・現在ユーザーで実行）:

```powershell
schtasks /Create /TN "LifeEditor-Digest" /SC DAILY /ST 06:03 /TR "powershell -NoProfile -ExecutionPolicy Bypass -File C:\Users\user\orca\life-editor\.claude\automation\run-routine.ps1 -Routine digest"
schtasks /Create /TN "LifeEditor-NightSafe" /SC DAILY /ST 22:33 /TR "powershell -NoProfile -ExecutionPolicy Bypass -File C:\Users\user\orca\life-editor\.claude\automation\run-routine.ps1 -Routine night-safe"
```

登録したら上表の Status を ACTIVE に更新し、Registered に日付を記入する。

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

→ 06:03 / 22:33 は既存と時間重複なし

---

## 履歴

- 2026-05-26: 台帳初期化（Cloud Routine 前提・Night = PENDING / Morning = DEFERRED のまま未稼働）
- 2026-08-04: Phase 1 改訂で全面書き換え（Cloud Routine 台帳を退役・Task Scheduler 案 + headless launcher へ。発火は D-20260804-main-1 裁定待ち）
