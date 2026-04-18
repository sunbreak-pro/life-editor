# HISTORY.md - 変更履歴

### 2026-04-18 - Routine Calendar 改善（Preview/Tag/削除カスケード + Group sort/頻度同期）

#### 概要

Routine Calendar まわりのユーザー要件 7 件を 1 セッションで実装。Calendar 上の Routine インスタンス preview popup の Edit ボタン無反応バグ修正と「詳細を開く」廃止、削除ボタンの「外す」ラベル化、`RoutineTagManager` のタグ色変更 UI 改善（色丸クリックで Portal ベースのカラーピッカー）、Rust 側の `routine_repository::soft_delete` を transaction 化して未完了 schedule_items のカスケード削除を実装。さらに Group Edit の Member Routines を startTime 昇順ソート、Group 保存時に member の頻度を Group の頻度で強制上書き、`RoutineEditDialog` に所属 Group の警告バナーを追加。計画書: `~/.claude/plans/routine-calendar-1-routine-edit-edito-ro-dreamy-crown.md`。

#### 変更点

- **ScheduleItemPreviewPopup 改修**: `onOpenDetail` prop と「詳細を開く」ボタン削除、Edit ボタン onClick の `onEditRoutine()` → `onClose()` 順序入替で state 更新競合の無反応バグを解消、削除ボタンを Routine インスタンス時のみ「外す」(`schedule.removeFromDay`)に条件分岐
- **onOpenDetail / onNavigateToEventsTab 連鎖削除**: CalendarView / OneDaySchedule / ScheduleTimeGrid / DualDayFlowLayout / ScheduleSection の各 prop / 受け渡しを一括除去（dead-code 化）
- **RoutineTagManager 色丸クリック対応**: 通常表示の色丸を `<button>` 化、`createPortal` + `getBoundingClientRect()` ベースの `ColorPickerPopover` を新設し `UnifiedColorPicker mode="preset-full" inline` をラップ。色選択即時反映＋自動クローズ、outside-click でも閉じる
- **Rust 削除カスケード**: `routine_repository::soft_delete` を `&mut Connection` + `conn.transaction()` 化し、`SELECT id FROM schedule_items WHERE routine_id = ?1 AND completed = 0` で取得した ID を DELETE。返り値を `Result<Vec<String>>` に変更し削除した schedule_item ID を返却。`db_routines_soft_delete` Tauri command も `Result<Vec<String>, String>` に変更
- **DataService 3点同期**: `DataService.softDeleteRoutine` 戻り型を `Promise<{ deletedScheduleItemIds: string[] }>` に変更、`TauriDataService` 実装と `mockDataService` モック追従
- **フロント state 同期**: `useScheduleItemsCore` に `removeScheduleItemsByIds(ids)` 追加（applyToLists で local state 一括除去 + bumpVersion）、`useScheduleItems` / `ScheduleItemsContextValue` に export、`useRoutines.deleteRoutine` を async 化して結果を返却、`RoutineContext.deleteRoutine` ラッパーで propagate、`ScheduleSidebarContent.handleDeleteRoutine` で削除→ローカル state 除去の連鎖を実装
- **Group Member Routine sort (G1)**: `useRoutineGroupComputed` で `memberRoutines` を `startTime` 昇順ソート（未設定は末尾、同時刻は title で tiebreak）。`RoutineGroupEditDialog.displayedRoutines` も create/edit 両モードで同様にソート
- **Group 頻度強制同期 (G2)**: `RoutineGroupEditDialog.handleSubmit` で Group 保存と同時に `displayedRoutines` 全員に `updateRoutine(id, { frequencyType, frequencyDays, frequencyInterval, frequencyStartDate })` を発火。`onUpdateRoutine` prop の Pick 型に frequency フィールドを追加。OneDaySchedule の Group dialog 利用箇所に欠けていた `onUpdateRoutine` を追加
- **Routine 個別編集の警告バナー (G3)**: `RoutineEditDialog` に `belongingGroups?: RoutineGroup[]` prop を追加し、所属 Group がある場合は FrequencySelector の上に amber トーンの情報バナー（`Info` icon + 所属 Group 名のリスト + 「次回の Group 保存で上書きされる」旨）を表示。CalendarView / OneDaySchedule は `groupForRoutine.get(id)`、RoutineManagementOverlay は `routinesByGroup` から逆引きで渡す
- **i18n 追加**: `schedule.removeFromDay`（en: "Remove from day" / ja: "外す"）、`routineGroup.frequencyOverrideWarning`（{{groups}} 補間付き）を en.json / ja.json 両方に追加
- **テスト追加**: `useRoutineGroupComputed.test.ts` を新設し 6 ケース（startTime 昇順 / 未設定末尾 / title tiebreak / archived/deleted 除外 / groupForRoutine 複数所属 / groupTimeRange min/max）。全 181 件 pass
- **Lint 修正**: `RoutineTagManager.ColorPickerPopover` の `useEffect`+`setPosition` を `useState` lazy initializer に置換し `react-hooks/set-state-in-effect` 警告を解消

### 2026-04-18 - アプリ再定義ロードマップ v2 Phase A 完了

#### 概要

「アプリケーション設計定義の統合 + 全機能要件定義」拡張ロードマップ v2 を策定し、Phase A（統合最上位 CLAUDE.md の作成 + ADR/rules/life-editor-v2/TODO の archive 移動 + README 簡素化）を完了。`.claude/CLAUDE.md` を 133 行 → 805 行（13 章構成）に拡張し、Life Editor の SSOT（Single Source of Truth）として確立。Claude Code が起動時に auto-load する唯一のファイルにビジョン・アーキテクチャ・規約・機能マップ・運用ガイドを集約。Phase B（Tier 1-3 全機能要件定義）と Phase C（実装プラン群整理 + 保留 5 件再評価）は次セッション以降。計画書: `.claude/feature_plans/2026-04-18-integrated-design-roadmap.md`。

#### 変更点

- **CLAUDE.md 13 章拡張 (Phase A-1/A-2)**: `0.Meta / 1.Core Identity / 2.Target User / 3.Value Propositions / 4.Non-Goals / 5.Platform Strategy / 6.Architecture / 7.Data Model / 8.AI Integration / 9.Coding Standards / 10.Workflows / 11.Feature Tier Map / 12.Document System / 13.Roadmap` の 13 章構成に再編。§1-5/8 はビジョン素案（ユーザーレビュー待ち）、§6-13 は既存資産から機械的吸収。Core Identity は「AI と会話しながら生活を設計・記録・運用するパーソナル OS」に確定（素案）
- **rules/ 全文吸収**: `project-debug.md` → §10.5、`project-patterns.md` → §9.2/9.3 + §6.2、`project-review-checklist.md` → §10.2/10.6 に分割吸収。`.claude/rules/` ディレクトリは `.claude/archive/rules/` に移動
- **ADR 0001-0004 archive (Phase A-3)**: `0001-tech-stack`（Superseded）/ `0002-context-provider-pattern`（Pattern A 統合済み）/ `0003-schedule-provider-decomposition`（§9.4 統合済み）/ `0004-schedule-shared-components`（§9.4 統合済み）を `.claude/archive/adr/` に移動。`ADR-0005-claude-cognitive-architecture`（PROPOSED）は `.claude/docs/adr/` に残置し §8.3 から要約参照
- **life-editor-v2 archive**: `00-vision / 01-terminal / 02-mcp-server / 03-claude-setup / 04-ui-adjustment` の 5 ファイルを `.claude/archive/docs/life-editor-v2/` に移動（要点は §6.5 / §8 に吸収済み）
- **TODO.md 廃止**: §13 Roadmap & Status に吸収後、`.claude/archive/TODO.md` に移動
- **README.md 簡素化**: 80 行 → 35 行。「主な機能」セクションを CLAUDE.md §11 へリンク化、技術スタック・セットアップ・ドキュメントリンクのみ残置
- **既存 3 プランに Status マーク**: `2026-04-18-app-redefinition-roadmap.md` を `Superseded by integrated-design-roadmap` に、`2026-04-18-application-definition-template.md` と `2026-04-17-daily-life-hub-requirements.md` を `Consumed (CLAUDE.md に吸収)` にマーク
- **新規プラン作成**: `.claude/feature_plans/2026-04-18-integrated-design-roadmap.md`（Phase A/B/C 全体ロードマップ）— 既存 3 プランを土台に拡張、Tier 1-3 全機能網羅要件定義 + 実装プラン整理戦略を記述

### 2026-04-18 - アプリ再定義ロードマップ策定

#### 概要

Electron → Tauri + モバイル追加で有機的に膨張したコードベースに対し、次セッション以降で「定義 → 要件 → 差分評価」の 3 ステップで再整理するためのロードマップを策定。`.claude/feature_plans/` に 3 ファイル作成し、チャット間の引き継ぎを確立。直近のコードレビューで保留となった 5 件（I-1 / S-2 / S-4 / S-5 / S-6）は実装 TODO ではなく「定義確定後に判断する問い」として位置づけ直し。

#### 変更点

- **ロードマップ (`2026-04-18-app-redefinition-roadmap.md`)**: 3 ステップ戦略（定義書 → 要件 Spec → 差分評価）と各ステップの goal / deliverable / 完了条件 / 検証項目を記述。ビジョン確定前は保留 5 件の実装着手を凍結する方針
- **定義書テンプレート (`2026-04-18-application-definition-template.md`)**: 最上位定義書の 8 セクション雛形（Core Identity / Target User / Core Value Propositions / Non-Goals / Platform Strategy / Data Model Philosophy / AI Integration Strategy / Feature Tier）。各セクションに記入ガイドと例示を付与
- **保留項目再評価 (`2026-04-18-deferred-items-reevaluation.md`)**: 5 件を Keep / Modify / Drop の判断フレームで整理。各項目に 3〜4 個の問いと判断材料（Tier / Target User / Platform Strategy の参照先）を記載。加えて「矛盾点」「不要機能候補」「負債」の空欄セクションを用意

### 2026-04-18 - コードレビュー + Blocking/Important バグ修正

#### 概要

Electron → Tauri 2.0 移行とモバイル対応追加後の保守性・バグ温床を Plan モードで全体調査し、Blocking 3 件・Important 5 件・Suggestion 2 件を実装修正。特に 4 つの TagAssignment API で Rust 側 camelCase ／ TS 側 snake_case の不整合によりサウンドタグ／ルーチンタグ等が実質無効化されていた**プロダクションバグ**を発見・修正。レビュー計画書: `~/.claude/plans/electron-tauri-snoopy-avalanche.md`。

#### 変更点

- **SyncContext 刷新 (B-1/I-2/I-3/S-3)**: `SyncContextValue` に `lastError`/`clearError` 追加、silent `catch {}` を排除して全エラーを state + toast に伝搬、`fullDownload()` にも catch を追加、`configure()` を `await runSync()` で待機化、`AbortController` で disconnect 時に in-flight sync をキャンセル、polling で `document.hidden`/`navigator.onLine` をチェック
- **soft-delete フィルタ整合 (B-2/B-3)**: `getSearchMatchIds` に `isDeleted` フィルタ追加＋祖先走査の deleted 停止、`useTaskTreeMovement` の `moveNodeInto`/`moveToRoot`/`moveNode` すべてに `isDeleted` ガード、`MoveRejectionReason` に `deleted_node` 追加、i18n `taskTree.move.deletedNode` 追加
- **🔴 TagAssignment snake_case バグ修正 (I-4)**: Rust 側は `soundId`/`tagId` 等の camelCase JSON を返していたのに TS 側が `sound_id`/`tag_id` で destructure していたため、4 機能（Sound tag, Routine tag, Calendar tag, Routine group tag）の assignments map がすべて空だった。consumer 4 ファイル + `DataService.ts` / `TauriDataService.ts` の型定義を camelCase に統一
- **モバイル IPC 無駄呼び排除 (I-5)**: `TimerContext.updateTrayTimer` を `isTauriMobile()` ガードで skip、iOS で毎秒の無駄 IPC を停止
- **MobileCalendarView パフォーマンス (I-1 部分)**: 日付変更用と syncVersion 用の useEffect を分離し、日付切替時の `fetchTaskTree()` 全件取得を排除。Rust `db_tasks_fetch_by_scheduled_range` 新コマンドは別タスクに切り出し
- **祖先走査の循環保護 (S-1)**: `utils/walkAncestors.ts` を新設（visited Set 付きの generator）、`folderColor.ts` / `folderTag.ts` / `buildCompletedTree.ts` の 4 箇所の `while (parentId) { ... }` ループを循環安全化
- **テスト追加**: `filterTreeBySearch.test.ts`（7件）、`useTaskTreeMovement.test.ts`（4件）、`walkAncestors.test.ts`（5件）で +16 件。全 175 件 pass
- **i18n 追加**: `sync.lastError`（en/ja）、`taskTree.move.deletedNode`（en/ja）

### 2026-04-18 - Rust コンパイラ警告 24 件修正

#### 概要

`cargo tauri build` で発生していた Rust 警告 24 件（未使用 import、未使用変数、dead code）をすべて解消。

#### 変更点

- **未使用 import 削除**: `Manager`（custom_sound_commands, attachment_commands, claude_commands）、`MenuItemKind`（menu.rs）、`super::helpers`（routine_repository, routine_tag_repository, routine_group_repository）
- **未使用変数**: custom_sound_commands の全 `app` 引数を `_app` に、attachment_commands の全 `app` を `_app` に、claude_commands の `setup_life_editor_dir` の `app` を `_app` に
- **dead code 削除**: `helpers.rs` の `fetch_deleted_json`, `next_order_index`, `next_sort_order`、`claude_detector.rs` の `get_state` メソッド

- 2026-04-17: [途中] iOS Safe Area 対応 — 計画書 `.claude/feature_plans/2026-04-17-ios-safe-area.md` 作成完了。MobileLayout.tsx の header/footer に `env(safe-area-inset-*)` padding を追加する方針。実装は次セッション

<!-- older entries archived to HISTORY-archive.md -->
