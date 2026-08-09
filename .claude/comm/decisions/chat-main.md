# Decisions — chat-main

形式は [`README.md`](./README.md) 参照。回答は `ANSWERS.md` へ。

## D-20260804-main-1: Phase 1 定期実行（朝 digest / 夜間安全レーン）の実行基盤をどれにするか

- 背景: 親計画 Phase 1（`2026-07-28-loop-engineering-harness.md` §6）のインフラは配置済み（PR = `docs/loop-harness-phase1`）だが、発火の足場が未裁定。実測で、セッション内 scheduled tasks（CronCreate）は**セッション限定 + 繰り返し 7 日期限**と判明し、常駐セッションなしでは毎朝発火に使えない
- A: **Windows Task Scheduler + `claude -p`（headless）**（推奨 — セッション常駐が不要・2026-07-16 の朝刊プロトタイプで同型を E2E 検証済み・digest の正本がローカルファイルである点とも整合。前提 = 06:03 / 22:33 に PC が起動していること。登録コマンドは `automation/routine-ids.md` に準備済み・初回は手動実行で動作確認）
- B: chat-main セッションを常駐させて CronCreate を使う（7 日ごとの再登録 + 台帳管理が必要。セッションを閉じると消える）
- C: クラウド実行（/schedule 系 — マシン電源に依存しないが、親計画 Non-goals「Cloud Routine の復活はしない」と衝突し、ローカルの digest / outbox ファイルに書けない。採る場合は親計画の改訂が先）
- 放置時: 自動発火なし（現状維持）。digest / 夜間安全レーンは手動起動（`run-routine.ps1` または dev-digest スキル）でのみ動く
- 期限感: いつでも（Phase 1 の効果量はここで決まるが、手動運用でも回る）

（回答済み 3 件 + 取り下げ 1 件は 2026-08-09 に `.claude/decisions/` 台帳へ昇格済み — D-20260801-main-1 / D-20260801-main-2 / D-20260731-main-2 / D-20260731-main-1）
