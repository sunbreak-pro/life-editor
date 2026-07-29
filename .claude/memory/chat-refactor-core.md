# MEMORY (chat-refactor-core)

## 進行中

### 🔧 SupabaseDataService 分割 + web hooks 切り出し（着手日: 2026-07-29）

**対象**: `shared/src/services/`・`web/src/`（CalendarTab.tsx 除外）
**計画書**: `.claude/docs/vision/plans/2026-07-28-refactor-dataservice-split.md`

- 前回: Step 1 完了 — 計画書 + `supabaseServiceHelpers.ts` + `SupabaseTasksService.ts` 切り出し（PR #457・3 ゲート緑 + lint 0 problems・session-verifier PASS）
- 現在: PR #457 の merge 待ち（ユーザーゲート）
- 次: merge 後に origin/main から `claude/refactor-02-routines-service` を切り、routine 系（`SupabaseRoutinesService`）を切り出す（PR #2）

## 直近の完了

（なし）

## 予定

- routine 系切り出し（PR #2）→ event・schedule 系（PR #3）→ calendar 系（PR #4）→ link・connection 系 stub + facade 最終化（PR #5）
- web 画面 hooks 切り出し: BriefingScreen → NotesView → MainScreen（CalendarTab は対象外 — schedule-refine レーン #290 と衝突回避）
