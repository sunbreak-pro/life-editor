# MEMORY (chat-schedule-event-routine)

## 進行中

### 🔧 Issue #185 Event/Routine 統合 — Step 3+ 実装（着手日: 2026-07-12）

**対象**: `shared/src/components/schedule/{EventEditorPane,RoutineEditorForm,FrequencyEditor}.tsx` / `web/src/schedule/{CalendarTab,RoutinesTab}.tsx` / `shared/src/services/{DataService,SupabaseDataService}.ts`（detachRoutine 新規のみ）/ `shared/src/i18n/locales/{en,ja}.json` / `shared/tests/`
**計画書**: `.claude/docs/vision/plans/2026-07-11-event-routine-unification.md`（既存・案 B 採用済み。新規計画書は作らない）

- 前回: Step 3+4 実装完了（監査 2 巡 PASS・shared 884/884・web build PASS・docs 追随済み）
- 現在: 実装 PR 提出 — merge 待ち（🛑 ユーザーゲート）
- 次: merge 後は chat-main が Step 5 playwright 実測（観察項目は計画書 Step 5 に記載）+ MCP 切り出し Issue 起票（outbox 依頼済み）→ Step 7 で #185 close + 計画書 COMPLETED 化

## 直近の完了

（なし）

## 予定

- #185 実装 PR 提出後: chat-main への MCP 切り出し Issue 起票依頼（outbox 経由・Step 6）
