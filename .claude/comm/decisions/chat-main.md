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

## D-20260810-main-3: STALE な旧アーキ由来スキル 5 本を書き直すか retire するか

- 背景: vendor 化（D-20260810-main-2）で repo に取り込んだ 8 本のうち **5 本が現行アーキ未追随**と判明した。`db-migration` は SQLite `PRAGMA user_version` + `electron/database/` 前提（実体は Supabase Postgres + `supabase/migrations/`）、`add-ipc-channel` は実在しない Electron / Tauri IPC 層の手順（同じ層の `-ipc-validator` は D-20260708-main-1 で retire 済み）、`add-component` / `add-feature` / `test-writing` は削除済みの `frontend/` ツリーと存在しないテストヘルパ（`renderWithProviders` / `mockDataService` は repo 内 0 件）を指す。repo 外にあったため PR レビューを一度も通っていない。**symlink 時代は「読めない = 無害な空振り」だったが、実ファイル化で「読めて、間違っている」に変わる**ため、当座は冒頭 STALE バナーで発火を止めてある
- A: **5 本とも現行アーキで書き直す**（推奨 — `add-component` / `test-writing` は `shared/src/components/` と `shared/tests/` の実物に倣うだけなので比較的軽い。`db-migration` は `db-conventions.md` §10 と CLAUDE.md §7.3 の内容と重複するので、スキルは薄い導線に絞る形もあり）
- B: **5 本とも retire（削除）する**（`lead-pipeline` + `rules/frontend.md` + `db-conventions.md` + CLAUDE.md §7.1 で実質カバーできており、スキルが増えるほど description の固定費も増える。失うのは「手順の型」だけ）
- C: 分割 — `add-ipc-channel` は retire（層自体が無い）、残り 4 本は書き直す
- 放置時: STALE バナーのまま残置（発火はしないので実害は無いが、死んだ手順が repo に居座り続ける）
- 期限感: 急がない。ただし新規スキルを足す前に決めたい（同じ型を増やさないため）

（回答済み 3 件 + 取り下げ 1 件は 2026-08-09 に `.claude/decisions/` 台帳へ昇格済み — D-20260801-main-1 / D-20260801-main-2 / D-20260731-main-2 / D-20260731-main-1）
