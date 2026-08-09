# Decisions — chat-main

形式は [`README.md`](./README.md) 参照。回答は `ANSWERS.md` へ。

## D-20260809-main-2: `archive/` の索引をどう再建するか

- 背景: `archive/` 直下は 84 本（SUMMARY.md 除く・2026-08-09 実測）。`SUMMARY.md` は 2026-07-08 に「**2026-05-23 以前**に archive 入りした分だけの索引」と役割を再定義され、以降の追加は載せない運用になっている。実測すると **63 本が SUMMARY に一度も名前が出ない**（= 索引外）。記録グラフ層は「入口から grep ゼロで届く」を狙ったが、archive だけがその外に残っている
- A: **`records.mjs` に archive スキャンを足して `archive/INDEX.md` を生成する**（推奨 — ファイル名 + Status 行 + H1 を機械抽出するだけなので plans と同じ決定論生成で済み、以降は archive 入りのたびに自動追随する。SUMMARY.md は「2026-05-23 以前の圧縮要約」として役割が違うので残す）
- B: SUMMARY.md を手で追補して 84 本を 1 枚にまとめる（要約の質は上がるが 63 本の読み直しが要り、archive 入りのたびに手作業が増える。2026-07-08 に「やらない」と決めた運用へ戻ることになる）
- C: 索引を作らない（archive を掘り返す頻度は低い。`.claude/INDEX.md` の型別正本表に「完了した計画 = archive/」の導線があれば足りると割り切る）
- 放置時: C 相当（現状維持）。63 本は各ファイル冒頭の Status 行と git 履歴が正本のまま
- 期限感: いつでも（他レーンの作業をブロックしない）

## D-20260804-main-1: Phase 1 定期実行（朝 digest / 夜間安全レーン）の実行基盤をどれにするか

- 背景: 親計画 Phase 1（`2026-07-28-loop-engineering-harness.md` §6）のインフラは配置済み（PR = `docs/loop-harness-phase1`）だが、発火の足場が未裁定。実測で、セッション内 scheduled tasks（CronCreate）は**セッション限定 + 繰り返し 7 日期限**と判明し、常駐セッションなしでは毎朝発火に使えない
- A: **Windows Task Scheduler + `claude -p`（headless）**（推奨 — セッション常駐が不要・2026-07-16 の朝刊プロトタイプで同型を E2E 検証済み・digest の正本がローカルファイルである点とも整合。前提 = 06:03 / 22:33 に PC が起動していること。登録コマンドは `automation/routine-ids.md` に準備済み・初回は手動実行で動作確認）
- B: chat-main セッションを常駐させて CronCreate を使う（7 日ごとの再登録 + 台帳管理が必要。セッションを閉じると消える）
- C: クラウド実行（/schedule 系 — マシン電源に依存しないが、親計画 Non-goals「Cloud Routine の復活はしない」と衝突し、ローカルの digest / outbox ファイルに書けない。採る場合は親計画の改訂が先）
- 放置時: 自動発火なし（現状維持）。digest / 夜間安全レーンは手動起動（`run-routine.ps1` または dev-digest スキル）でのみ動く
- 期限感: いつでも（Phase 1 の効果量はここで決まるが、手動運用でも回る）

（回答済み 3 件 + 取り下げ 1 件は 2026-08-09 に `.claude/decisions/` 台帳へ昇格済み — D-20260801-main-1 / D-20260801-main-2 / D-20260731-main-2 / D-20260731-main-1）
