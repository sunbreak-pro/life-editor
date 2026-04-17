# HISTORY.md - 変更履歴

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

### 2026-04-18 - Cloud Sync UI リフレッシュ修正

#### 概要

Cloud Sync でデータを pull した後に iOS/Desktop の UI が更新されない問題を修正。`syncVersion` カウンターによる自動再取得メカニズムと、configure 後の即時 sync を実装。

#### 変更点

- **SyncContext**: `syncVersion` state を追加。`pulled > 0` 時にインクリメントし、`configure()` 成功後に即時 `triggerSync()` を呼び出し（30秒待ち解消）
- **データフック（7ファイル）**: `useTaskTreeAPI`, `useMemos`, `useNotes`, `useRoutines`, `useCalendars`, `useTemplates`, `ScheduleItemsContext` の初期ロード `useEffect` 依存配列に `syncVersion` 追加。sync 完了時に自動再取得
- **モバイルビュー（5ファイル）**: `MobileTaskView`, `MobileMemoView`, `MobileNoteView`, `MobileCalendarView`, `MobileScheduleView` のデータロード `useEffect` に `syncVersion` 依存追加
- **useTemplates リファクタ**: `loadedRef` ガードを撤去し、標準 `cancelled` cleanup パターンに統一

- 2026-04-17: [途中] iOS Safe Area 対応 — 計画書 `.claude/feature_plans/2026-04-17-ios-safe-area.md` 作成完了。MobileLayout.tsx の header/footer に `env(safe-area-inset-*)` padding を追加する方針。実装は次セッション

### 2026-04-17 - CLAUDE.md 現状コード反映更新

#### 概要

Tauri 2.0 移行・機能追加後の CLAUDE.md を現在のコードベースと照合し、5箇所の差分を修正。

#### 変更点

- **モバイル判定**: `isTauri() が false` → `isTauriMobile() が true`（Tauri + iOS デバイス判定）に修正
- **Provider スタック（Desktop/Mobile）**: Calendar と Memo の間に `Template` を追加（TemplateProvider の記載漏れ）
- **ソフトデリート対象**: Templates を追加（Tasks/Notes/Memos/Routines/Databases/Templates）
- **SectionId**: `schedule/materials/connect/work/analytics/settings` の6値を明記（旧 tasks/memo/trash/tips は廃止済み）
- **ID 生成**: `generateId(prefix)` 関数名を明記、UUID 例を `note-xxxxxxxx-xxxx-...` に修正

### 2026-04-16 - Tauri 2.0 Migration: Phase 6 Cloud Sync (CF Workers + D1)

#### 概要

Cloudflare Workers + D1 によるクラウド同期機能を実装。Desktop ↔ iOS 間のデータ同期を実現。Cloud backend (Hono REST API)、Rust sync engine (delta query + batch apply + HTTP client)、Frontend integration (SyncProvider + Settings UI) の3層を新規構築。

#### 変更点

- **Cloud Backend (`cloud/`)**: Hono + Wrangler プロジェクト新規作成。D1 スキーマ（10 versioned テーブル + 8 relation テーブル）、Token 認証ミドルウェア、3 API エンドポイント（`/sync/full`, `/sync/changes`, `/sync/push`）。Last-write-wins 競合解決（version カラム比較）
- **Rust Sync Engine (`src-tauri/src/sync/`)**: `sync_engine.rs`（collect_local_changes / collect_all / apply_remote_changes）、`http_client.rs`（reqwest + rustls-tls で iOS 対応）、`types.rs`（SyncPayload / SyncResult / SyncStatus / SyncError）。5 Tauri コマンド（sync_configure / sync_trigger / sync_get_status / sync_disconnect / sync_full_download）
- **Frontend Integration**: SyncProvider/Context（ADR-0002 Pattern A 3ファイル構成）、30秒ポーリング同期、`sync_complete` Tauri Event によるデータ再取得トリガー。Desktop Settings（Advanced > Cloud Sync）+ Mobile Settings に同期設定 UI。DataService + TauriDataService に5メソッド追加
- **Bug fix**: `create_full_schema()` の memos/notes テーブルに欠落していた `version INTEGER DEFAULT 1` カラムを追加
- **Bug fix**: `sync_engine.rs` の SQL 文字列補間を `query_all_json_with_params()` によるパラメータバインドに修正
- **Bug fix**: `SyncContext.tsx` の `isSyncing` stale closure 問題を useRef ガードで修正（interval リセットループ防止）
- **helpers.rs**: `query_all_json_with_params()` ヘルパー関数追加（パラメータ付き SQL クエリ）
- **i18n**: en.json / ja.json に sync セクション（16キー）追加
- **mockDataService.ts**: sync 5メソッドのモック追加
- **Cargo.toml**: `reqwest` 依存追加（rustls-tls feature、iOS OpenSSL 不要）

<!-- older entries archived to HISTORY-archive.md -->
