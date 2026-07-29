# MEMORY (chat-refactor-core)

## 進行中

### 🔧 SupabaseDataService 分割 + web hooks 切り出し（着手日: 2026-07-29）

**対象**: `shared/src/services/`・`web/src/`（CalendarTab.tsx 除外）
**計画書**: `.claude/docs/vision/plans/2026-07-28-refactor-dataservice-split.md`

- 前回: Phase B Step 1 完了 — BriefingScreen（850 行）を `useBriefingData` + `useDailySections` + 画面（約 290 行）に分割（PR #462・3 ゲート緑 + lint 0 problems・session-verifier PASS）。Phase A 最終 PR #461 も merge 待ち中に提出済み
- 現在: PR #461（Phase A 最終）と PR #462（Phase B Step 1）の merge 待ち（ユーザーゲート。両者はファイル非重複で独立 merge 可）
- 次: merge 後に origin/main から `claude/refactor-07-notesview-hooks` を切り、NotesView（約 1313 行）の hooks 切り出し（Phase B Step 2）

## 直近の完了

- DataService 分割 Step 4（calendar 系・PR #460 merged）✅（2026-07-29）
- DataService 分割 Step 3（event・schedule 系・PR #459 merged）✅（2026-07-29）
- DataService 分割 Step 2（routine 系・PR #458 merged）✅（2026-07-29）

## 予定

- web 画面 hooks 切り出し（Phase B 残り）: NotesView → MainScreen（CalendarTab は対象外 — schedule-refine レーン #290 と衝突回避）
