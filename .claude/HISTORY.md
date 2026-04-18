# HISTORY.md - 変更履歴

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

### 2026-04-18 - TypeScript build エラー 109 件修正

#### 概要

`cargo tauri build` が TypeScript 109 件のエラーで失敗していた問題を全て解消。React 19 / Recharts / lucide-react の型厳格化に起因する機械的修正に加え、`OneDaySchedule.tsx` の picker state 欠落 / `RoutineNode`・`RoutineGroup` 更新型の Pick 欠落 / `UpdaterStatus` 型の重複定義といった構造的問題も修正。DayFlow の Routine / Note picker をデスクトップ版で復活させた。

#### 変更点

- **構造修復**: `OneDaySchedule.tsx` に `routinePicker` / `notePicker` state を復活し、`RoutinePickerPanel` / `NoteSchedulePanel` を JSX レンダリング。`TimeGridClickMenu` に「Select Note」オプションを追加
- **型定義修正**: `UpdaterStatus` を `types/updater.ts` に一本化（`services/events.ts` のローカル重複定義を削除）、`useTaskDetailHandlers.setScheduleTab` を `Dispatch<SetStateAction<ScheduleTab>>` に修正、`RoutineManagementOverlay` の `onUpdateRoutine` / `onUpdateRoutineGroup` Pick に `isVisible` 追加、`DualDayFlowLayout.DualColumn` の props に `onSetTaskStatus` / `onNavigateToEventsTab` 追加
- **TaskNode / WikiTag 型**: `buildCompletedTree.ts` の `sortOrder` → `order` へ置換、`wikiTag.textColor` / `UnifiedColorPicker.textColor` を `string | null` 許容化、`SettingsInitialTab` に `"mobile"` を追加、`ToastVariant` に `"info"` を追加（アイコン実装込み）、`SearchSuggestionIconType` に `"board"` 追加
- **Recharts / React 19 / lucide-react 対応**: `formatter` コールバックの `value` / `name` を `undefined` 許容に広げる（5ファイル）、`useRef<T>()` → `useRef<T \| undefined>(undefined)`（3ファイル）、`useDebouncedCallback` を `TArgs` ジェネリクスに刷新、lucide-react Icon の `title` prop を `<span title>` 親要素にラップ（4箇所）
- **null → undefined 統一**: `scheduledAt: null` を `undefined` に変更し（6箇所）、`parseScheduledAt` のシグネチャを `string \| null \| undefined` に拡張
- **ConnectionMode / prop 名修正**: `connectionMode="loose"` を `ConnectionMode.Loose` enum に置換、`onIsAllDayChange` → `onAllDayChange` にリネーム（NoteSchedulePanel / RoutinePickerPanel）
- **MiniTodayFlow / ScheduleTimeGrid**: discriminated union の type guard 追加（`entry.type !== "task"` で narrowing）、`shouldRoutineRunOnDate` 呼び出しで `date: Date` → `dateKey: string` に修正
- **未使用変数削除**: TS6133 エラー約 25 件を単純削除または destructure から除外（Sidebar / Paper / Settings / Schedule / Tasks 系の複数ファイル）
- **その他**: `TimeGridTaskBlock` に `onClick` prop 追加（`WeeklyTimeGrid` で silently drop されていた callback を有効化）、`TipTap` の `fileUploadPlaceholder` extension storage を型アサーションで参照、`WorkMusicContent.togglePreview(id, url)` で `audio.soundSources` から URL 解決、`MaterialsView` の未使用 props を削除

- 2026-04-17: [途中] iOS Safe Area 対応 — 計画書 `.claude/feature_plans/2026-04-17-ios-safe-area.md` 作成完了。MobileLayout.tsx の header/footer に `env(safe-area-inset-*)` padding を追加する方針。実装は次セッション

<!-- older entries archived to HISTORY-archive.md -->
