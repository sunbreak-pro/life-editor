# MEMORY (chat-refactor-core)

## 進行中

### 🔧 SupabaseDataService 分割 + web hooks 切り出し（着手日: 2026-07-29）

**対象**: `shared/src/services/`・`web/src/`（CalendarTab.tsx 除外）
**計画書**: `.claude/docs/vision/plans/2026-07-28-refactor-dataservice-split.md`

- 前回: Phase B Step 2 完了 — NotesView hooks 切り出し（PR #463 merged）。Phase A 全 5 PR + Phase B Step 1/2 すべて merge 済み
- 現在: Issue #465 = MainScreen（951 行）の hooks 切り出し（Phase B Step 9・計画最終ステップ）。branch `claude/refactor-08-mainscreen-hooks` で実装中
- 次: 3 ゲート（shared test / shared build / web build）→ session-verifier → 計画書 COMPLETED + archive 移動 → PR（Fixes #465）

## 直近の完了

- Phase B Step 2（NotesView hooks・PR #463 merged）✅（2026-07-29）
- Phase B Step 1（BriefingScreen hooks・PR #462 merged）✅（2026-07-29）
- DataService 分割 Step 5（facade 最終化・PR #461 merged = Phase A 完了）✅（2026-07-29）

## 予定

- （なし — #465 が本レーン最後の担当 Issue。merge 後に outbox へ「#465 merge 済み」を append し #472/#473 を解禁）
