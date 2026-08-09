# .claude INDEX — 記録の入口

> **生成物 — 手編集禁止。** 再生成: `node .claude/scripts/records.mjs index`（plans/ か decisions/ を変えた PR と同一コミットで再生成 — 鮮度は `records.mjs check` が CI で検証）。
> 無人セッションの読む順: CLAUDE.md（自動ロード）→ 本ファイル → [`decisions/INDEX.md`](./decisions/INDEX.md) §Open + [`comm/decisions/ANSWERS.md`](./comm/decisions/ANSWERS.md) → `memory/chat-<self>.md` → 自分宛 open Issue。ここまで grep なしで届く。

## 進行中の計画（`docs/vision/plans/` の Status 行より）

| 計画 | Status |
| --- | --- |
| [2026-05-23-cleanup-and-consolidation-deletion-targets.md](./docs/vision/plans/2026-05-23-cleanup-and-consolidation-deletion-targets.md) | REFERENCE — 実削除は 2026-07-11 に完了（src-tauri = |
| [2026-05-24-multi-chat-worktree-policy.md](./docs/vision/plans/2026-05-24-multi-chat-worktree-policy.md) | ACTIVE (adopted policy) — 規約として採用・運用中（SSOT は CLAUDE.md §7.4。本計画書は詳細・背景の参照元） |
| [2026-05-26-autonomous-dev-routine.md](./docs/vision/plans/2026-05-26-autonomous-dev-routine.md) | BLOCKED — Night Routine 登録が trig_PENDING のまま（registration pending）。機構は実装済みだが夜 Routine の Anthropic Cloud 登録が未実施のため発火しない |
| [2026-06-19-step1-desktop-daily-driver.md](./docs/vision/plans/2026-06-19-step1-desktop-daily-driver.md) | IN PROGRESS — 自律スコープ（Tray 常駐 / 自動起動 / bounds クランプ / icon 同梱）は PR |
| [2026-07-14-schedule-redesign.md](./docs/vision/plans/2026-07-14-schedule-redesign.md) | IN PROGRESS — Step 0〜7 は全て実装済み（5-b = |
| [2026-07-15-briefing-loop.md](./docs/vision/plans/2026-07-15-briefing-loop.md) | ACTIVE (adopted policy) |
| [2026-07-16-briefing-headless-claude-prototype.md](./docs/vision/plans/2026-07-16-briefing-headless-claude-prototype.md) | REFERENCE |
| [2026-07-28-loop-engineering-harness.md](./docs/vision/plans/2026-07-28-loop-engineering-harness.md) | IN PROGRESS — Phase 0 配置完了（PR |
| [2026-07-30-open-issue-fanout-r2.md](./docs/vision/plans/2026-07-30-open-issue-fanout-r2.md) | IN PROGRESS |
| [2026-08-04-context-cost-reduction-harness.md](./docs/vision/plans/2026-08-04-context-cost-reduction-harness.md) | IN PROGRESS |
| [2026-08-04-loop-catalog-implementation.md](./docs/vision/plans/2026-08-04-loop-catalog-implementation.md) | IN PROGRESS |
| [2026-08-04-loop-catalog.md](./docs/vision/plans/2026-08-04-loop-catalog.md) | IN PROGRESS |
| [2026-08-06-autonomous-operation-endpoint.md](./docs/vision/plans/2026-08-06-autonomous-operation-endpoint.md) | IN PROGRESS |
| [2026-08-07-web-mobile-public-url.md](./docs/vision/plans/2026-08-07-web-mobile-public-url.md) | IN PROGRESS |
| [2026-08-09-record-graph-layer.md](./docs/vision/plans/2026-08-09-record-graph-layer.md) | IN PROGRESS |

## 判断の現在地

- 未回答（キュー）: 7 件 → [`decisions/INDEX.md`](./decisions/INDEX.md) §Open
- 確定台帳: 18 件（うち Active 17）→ [`decisions/INDEX.md`](./decisions/INDEX.md)

## 型別の正本（この情報はどこにあるか）

| 探しもの | 正本 |
| --- | --- |
| 決定の Why・却下案 | [`decisions/`](./decisions/README.md)（索引 = INDEX.md） |
| 「聞かなくていい」恒久裁定 | [`comm/decisions/POLICY.md`](./comm/decisions/POLICY.md) |
| レーンの進行中 / 履歴 | `memory/chat-*.md` / `history/chat-*.md`（per-chat SSOT。集約は SessionStart hook 生成の派生 INDEX） |
| 課題の追跡 | GitHub Issues（`gh issue list -R sunbreak-pro/life-editor`） |
| 障害知見（環境系含む） | [`docs/known-issues/INDEX.md`](./docs/known-issues/INDEX.md) |
| 完了した計画 | `archive/`（2026-05-23 以前の索引 = [`archive/SUMMARY.md`](./archive/SUMMARY.md)） |
| チャット間の連絡 | `comm/outbox/chat-*.md`（プロトコル = [`comm/README.md`](./comm/README.md)） |
| どこに書くかの判定 | [`rules/records.md`](./rules/records.md) |
