# HISTORY (chat-schedule-event-routine)

### 2026-07-12 - Issue #185 Step 3+4 実装（Event 編集フローへ繰り返し組込 + detachRoutine + Repeats タブ化）

#### 概要

chat-schedule-refine から #185 Step 3+ を引き継ぎ（ユーザー指示・outbox 宣言）、既存計画書 `2026-07-11-event-routine-unification.md`（案 B）に沿って Event 編集フローへの繰り返しセクション組込・`detachRoutine` 新規実装・Routines タブの「繰り返し / Repeats」化を実装した。DDL 変更ゼロ・shell 部品無接触。

#### 変更点

- **EventEditorPane / CalendarTab**: 全 Event 共通の繰り返しセクション（FrequencyEditor・「なし」起点・group 新規設定不可）。routine 由来 occurrence は read-only チップを編集セクションに置換（系列 = Routine patch）。手動 Event の繰り返し化はシード Event 削除 + Routine 生成
- **detachRoutine（DataService / SupabaseDataService / useRoutinesAPI）**: 今日以降・未完了・live の occurrence を soft-delete → 生存 occurrence（過去分・完了済み分）の `routine_item_id`/`source_date` を NULL 化して真に切り離し（detach → ゴミ箱 purge で過去実績が消える経路を封鎖）→ Routine 本体を cascade なしで soft-delete。全対象行 `items_meta.updated_at` bump（LWW 維持）。`todayDateKey()`（day-start-hour pref 対応）+ `fetchAllPages` ページング
- **UI 信頼性**: 解除は fire-and-forget をやめ返却 id で reconcile・失敗時ロールバック + reloadKey 復帰
- **i18n**: routines→Repeats/繰り返し・frequency→Repeat/繰り返し・frequencyNone 追加（en/ja 対称）
- **テスト**: `shared/tests/detachRoutine.test.ts` 新規 5 件。shared 884/884 PASS・shared/web build PASS（メイン再実測済み）
- **監査**: role-qa + sync 特化監査（1 巡目 PASS with Should / Blocking 0）→ Should 3 件修正 → 2 巡目 role-qa PASS（Blocking 0 / Should 0）
- **docs**: 計画書 UX 仕様 2 の伝播記述を実測訂正（sync 系は web host 未配線の pre-existing）+ Step 5 観察項目追加 + Worklog / CLAUDE.md §4 1 行 / tier-1-core 1 行注記
- **残ゲート**: Step 5 playwright（chat-main・merge 後）/ Step 6 MCP 切り出し Issue 起票（chat-main 依頼）/ Step 7 PR merge → #185 close（ユーザー）
