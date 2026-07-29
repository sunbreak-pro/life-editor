# MEMORY (chat-refactor-core)

## 進行中

### 🔧 SupabaseDataService 分割 + web hooks 切り出し（着手日: 2026-07-29）

**対象**: `shared/src/services/`・`web/src/`（CalendarTab.tsx 除外）
**計画書**: `.claude/docs/vision/plans/2026-07-28-refactor-dataservice-split.md`

- 前回: Phase B Step 2 完了 — NotesView（1313 行）を `useNoteListState` + `useNoteLinking` + `NoteListRows` + 画面（約 890 行）に分割（PR #463・全ゲート緑・session-verifier PASS）。#461 / #462 は merge 済みで Phase A 完了
- 現在: PR #463（Phase B Step 2）の merge 待ち（ユーザーゲート）
- 次: merge 後に origin/main から `claude/refactor-08-mainscreen-hooks` を切り、MainScreen（約 951 行）の hooks 切り出し（Phase B Step 3・最終。CalendarTab は対象外）

## 直近の完了

- Phase B Step 1（BriefingScreen hooks・PR #462 merged）✅（2026-07-29）
- DataService 分割 Step 5（facade 最終化・PR #461 merged = Phase A 完了）✅（2026-07-29）
- DataService 分割 Step 4（calendar 系・PR #460 merged）✅（2026-07-29）

## 予定

- web 画面 hooks 切り出し（Phase B 残り）: MainScreen（CalendarTab は対象外 — schedule-refine レーン #290 と衝突回避）
