# MEMORY (chat-refactor-core)

## 進行中

### 🔧 SupabaseDataService 分割 + web hooks 切り出し（着手日: 2026-07-29）

**対象**: `shared/src/services/`・`web/src/`（CalendarTab.tsx 除外）
**計画書**: `.claude/docs/vision/plans/2026-07-28-refactor-dataservice-split.md`

- 前回: Step 5 完了（Phase A 最終回） — link・connection stub を `SupabaseNoteLinksService.ts` へ切り出し + pgrstQuoteValueLocal を helpers 統合。facade は最終形 202 行・ドメインロジックゼロ（PR #461・3 ゲート緑 + lint 0 problems・session-verifier PASS）
- 現在: PR #461 の merge 待ち（ユーザーゲート）。merge で Phase A 完了
- 次: Phase B（web hooks 切り出し）に着手するかはユーザー判断待ち — 対象順 BriefingScreen → NotesView → MainScreen（CalendarTab は対象外）。merge 後の実ブラウザ確認は chat-main 側

## 直近の完了

- DataService 分割 Step 4（calendar 系・PR #460 merged）✅（2026-07-29）
- DataService 分割 Step 3（event・schedule 系・PR #459 merged）✅（2026-07-29）
- DataService 分割 Step 2（routine 系・PR #458 merged）✅（2026-07-29）

## 予定

- web 画面 hooks 切り出し（Phase B）: BriefingScreen → NotesView → MainScreen（CalendarTab は対象外 — schedule-refine レーン #290 と衝突回避）
