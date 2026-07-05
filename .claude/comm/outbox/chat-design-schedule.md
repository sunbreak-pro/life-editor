# Outbox: chat-design-schedule

## 2026-07-05 — Schedule design brief 完了（draft PR 提出）

- 成果物: `.claude/docs/design/briefs/schedule.md`（新規、_TEMPLATE 完全準拠、Status: Draft）
- ブランチ / PR: `claude/design-brief-schedule` → draft PR「docs: design brief — schedule」（diff は brief 1 ファイルのみ・コード変更 0）
- 内容: Desktop 1440×900 = 週タイムグリッド主役 + 右パネル（イベント編集 / ルーチンサマリー / ルーチン管理 Sheet）で 7 フレーム。Mobile 390×844 = 今日のアジェンダ + FAB Quick capture シートで 7 フレーム。routine=藍 + Repeat アイコン / event=紫 の既存符号色で由来を可視化。頻度 4 型（daily / weekdays / interval / group）をサンプルデータで実演。両プロンプトのサンプルは同一日 2026-07-09(木) で完全整合
- 検証: 6 並列リサーチ → 4 レンズ アドバーサリアル検証 → 修正 → 再検証 7/7 PASS。逐語埋め込みは diff で一致確認、フェンス内リポジトリパス 0
- ⚠️ **escalation（orchestrator 宛て）**: `_COMMON-CONTEXT.md` の palette が PR #135 に未同期（accent: 旧 light `#1f4fff` / dark `#5b82ff` のまま。現 tokens.css は `#1d4ed8` / `#5b8cff`、chip-task 系も変更済み）。「tokens.css → _COMMON-CONTEXT → 各 brief」の同期規則に基づき _COMMON-CONTEXT の更新が必要。改変禁止規則のため本 brief は現行本文を逐語埋め込みし、§6 に再コピー指示を明記済み。同期後に全 brief の §4 共通ブロック再コピーを推奨
- gate 残: merge / ClaudeDesign 投入 = ユーザー。tracker メタ（memory/history chat-design-schedule）は plan AC 維持のため未コミットで worktree に保持
- PR: https://github.com/sunbreak-pro/life-editor/pull/141 （draft。head = `claude/design-brief-schedule` @ `2e4652d3` = origin/main `597c11ce` + brief 1 コミットのみ）

## 2026-07-05 — ⚠️ インシデント申し送り: worktree 共有によるブランチ混線

- **事象**: 複数の design チャットが同一 worktree（`.claude/worktrees/frontend`）で作業しており、"1 chat = 1 worktree = 1 branch" が破られている。私（design-schedule）の commit 実行時点で HEAD が `claude/design-brief-analytics` に切り替わっており、迷子コミット `8bd4e303`（schedule.md 追加）が **analytics ブランチのローカル tip**（`c86c9203` = analytics tracker commit の上）に載ってしまった
- **復旧済み**: 一時 index + `git commit-tree` で origin/main 直上に `2e4652d3` を再構築し、`claude/design-brief-schedule`（local + remote）へ反映。PR #141 の diff は schedule.md 1 ファイルのみで正常
- **要対応（analytics レーン所有者 or ユーザー）**: ローカル `claude/design-brief-analytics` の tip に残る `8bd4e303` の除去（例: そのレーンで `git reset --hard c86c9203`）。放置して push すると analytics PR の diff に schedule.md が混入する（内容は PR #141 と同一 blob なので、#141 が先に merge されれば diff からは自然に消える）
- **再発防止の提案**: 各 design チャット起動前に worktree を分離するか、commit 直前に `git rev-parse --abbrev-ref HEAD` で自レーンのブランチであることを検証するステップを標準化する
