# HISTORY.md - 変更履歴

### 2026-04-18 - アプリ再定義ロードマップ v2 Phase C 完了（feature_plan 棚卸し + 保留 5 件 Verdict 確定）（計画書: archive/2026-04-18-integrated-design-roadmap.md）

#### 概要

Phase B に続いて Phase C を完遂。事前データ表（calendar plan §Phase C）をベースに既存 feature_plan 9 件を Merge / Drop 判定で archive へ移動し、保留 5 件（I-1 / S-2 / S-4 / S-5 / S-6）の Verdict を確定。Keep 判定の 4 件を新規 plan、Modify / Option A 決定の 2 件を新規 ADR として起票。これで Life Editor プロジェクトの SSOT（CLAUDE.md 13 章 + requirements/ 26 機能）と、アクティブ plan 群（4 件の具体的な実装候補）が一貫した状態で整った。

#### 変更点

- **feature_plan 9 件の archive 移動**:
  - Drop 5 件 → `.claude/archive/dropped/`:
    - `019-phase1-security-critical-fixes.md`（Electron 前提、2026-02-22 作成 3 ヶ月放置）
    - `020-phase2-data-integrity.md` / `021-phase3-architecture-improvement.md` / `022-phase4-quality-optimization.md`（同上、Tauri 2.0 migration で対象コード消失）
    - `2026-04-14-capacitor-ios-standalone.md`（Tauri Mobile 採用で不要）
  - Merge 4 件 → `.claude/archive/`:
    - `023-cmux-terminal-features.md` → Terminal Future Enhancements（分割ペインのみ採用、Socket API は Boundary と矛盾で不採用）
    - `025-life-editor-ui-ux-refactor.md` → CLAUDE.md §1-5 + tier-2-supporting の Theme / Shortcuts に吸収済
    - `2026-03-16-mobile-phase2-realtime-sync.md` → Cloud Sync Future Enhancements（WebSocket / SSE リアルタイム push）
    - `2026-03-16-mobile-phase3-offline-standalone.md` → Cloud Sync Known Issues + Future（オフラインキュー / conflict resolution / claude\_\* テーブル対応）
  - 各ファイルに `Status: DROPPED (reason)` または `Status: MERGED (target + reason)` マークを追記

- **保留 5 件の Verdict 確定と後続ファイル起票**:
  - **I-1 (Rust `db_tasks_fetch_by_scheduled_range`)**: Keep (measurement-first) → `.claude/feature_plans/2026-04-18-tasks-fetch-by-range.md` 起票（iOS で 500 / 1000 / 3000 件計測 → しきい値 500ms 以上なら実装）
  - **S-2 (Tauri IPC naming policy)**: Modify (ADR-only) → `.claude/docs/adr/ADR-0006-tauri-ipc-naming-policy.md` 起票。規約明文化のみ、150 コマンド全件 typed struct 化は不採用
  - **S-4 (computeFolderProgress batch memo)**: Keep (measurement-first) → `.claude/feature_plans/2026-04-18-folder-progress-batch-memo.md` 起票（React Compiler 有効化後再計測、Profiler で 150ms 超なら一括 Map 計算に切替）
  - **S-5 (useServiceErrorHandler)**: Keep (immediate) → `.claude/feature_plans/2026-04-18-service-error-handler-hook.md` 起票。V2「信頼できるデータ」を silent failure が直接損なうため即時実装可
  - **S-6 (Mobile Provider strategy)**: Keep Option A → `.claude/docs/adr/ADR-0007-mobile-provider-strategy.md` で Optional hook 採用決定 + `.claude/feature_plans/2026-04-18-context-hook-optional.md` 実装 plan 起票。Stub Provider（Option B）は Mobile バンドル膨張のため不採用

- **deferred-items-reevaluation.md**: Status: Consumed (Phase C 完了) に更新 + 冒頭に Verdict 集約表を追加 → `.claude/archive/` に移動

- **requirements/ の Related Plans 更新**:
  - §Tasks Related Plans: I-1 / S-4 の新規 plan リンク追加
  - §Schedule Related Plans: Schedule 3 Provider ADR のリンクは archive 維持（変更なし）
  - §Cloud Sync Related Plans: MERGED 2 件を archive リンクに書換 + 吸収済 note 追記
  - §Terminal Related Plans: MERGED 023 を archive リンクに書換 + Boundary 矛盾 note 追記
  - §Toast Known Issues: S-5 の新規 plan リンク追加 + Related Plans セクション新設

- **計画書更新**: §Phase C-1（Steps 5 件 + Verification 3 件）と §Phase C-2（Steps 6 件 + Verification 4 件）を全て `[x]` に

- **MEMORY.md 更新**: 直近完了に Phase C 追加、予定を「Phase C 起票の新規 plan 4 件（優先度順）」に書換。1. S-5 即時実装可 / 2. S-6 Option A 実装 / 3. I-1 計測 first / 4. S-4 計測 first の順

- **最終状態サマリー**:
  - `.claude/feature_plans/` PLANNED: 4 件（Phase C 起票、他は Consumed/Superseded/IN_PROGRESS）
  - `.claude/docs/adr/` Active: 3 件（ADR-0005 PROPOSED / ADR-0006 Accepted / ADR-0007 Accepted）
  - `.claude/archive/dropped/` 新設: 5 件（Electron 前提 Plan + Capacitor）
  - `.claude/archive/` Merge 4 件追加

### 2026-04-18 - アプリ再定義ロードマップ v2 Phase B 完了（Tier 1-3 全 26 機能要件定義）

#### 概要

同日 B-1 完了に続けて Phase B-2 / B-3 を連続実施し、全 Tier の要件定義を完遂。Tier 2（12 機能 / AC 各 3-6 件）と Tier 3（6 機能 / Verdict 付き）を記入し、CLAUDE.md §11 に相互リンク（markdown link）+ Verdict 反映を行った。CLAUDE.md §11 機能数 = requirements/ 機能数 = 26 で差分ゼロを確認。Phase C（実装プラン群の整理 + 保留 5 件再評価）は次セッション以降。

#### 変更点

- **tier-2-supporting.md（364 → 495 行）**: 全 12 機能の Purpose / Boundary / AC 3-6 件 / Dependencies を記入。プレースホルダ残存ゼロを grep 確認
- **Audio Mixer**: AC 5 件（on/off + ボリューム、magic bytes 検証、プリセット、タグ、AudioContext resume）
- **Playlist**: AC 5 件（DnD reorder、タイマー連動自動開始、シャッフル / リピート、Pause 追従）
- **Pomodoro Timer**: AC 6 件（プリセット、完了フロー、3 箇所残り時間同期、±5m 調整、timer_sessions 記録、sessionsBeforeLongBreak）
- **WikiTags**: AC 5 件（横断付与、sync_inline_tags、CRUD + 色ピッカー、接続の有向グラフ、MCP tag_entity）+ IPC 21 件列挙
- **File Explorer**: AC 5 件（ルート選択、パストラバーサル検証、FileEditor 永続化、attachment_save、Mobile 省略）+ IPC 17 件列挙
- **Templates**: AC 4 件（JSON 保存、新規 ID 展開、ソフトデリート、rename）+ `task_templates` レガシーテーブル残留を Known Issues に記録（実コード調査発見）
- **UndoRedo / Theme / i18n / Shortcuts / Toast / Trash**: AC 3-5 件ずつ記入（ドメイン別スタック / 10 段階フォント / en/ja / 29 shortcuts / 4 種トースト / 7 ドメイン復元）
- **tier-3-experimental.md（173 行）**: 6 機能に Verdict ラベル付与
  - **Paper Boards**: 凍結継続（13 commits、2026-04-12 で機能追加停止、Notes / WikiTag Connections で代替可）
  - **Analytics**: 凍結継続 + ADR-0005 Phase 4 統合予定（17 commits、2026-02-25 で機能追加停止）
  - **NotebookLM / Google Calendar / Google Drive**: 未着手（Claude 経由代替 / ICS 購読 Phase 1 / google-drive MCP で各対応）
  - **Cognitive Architecture (ADR-0005)**: PROPOSED 維持（Phase 1 から段階着手）
- **CLAUDE.md §11 更新**: tier-1/2/3 リンクを markdown link 化、各 Tier 冒頭の「（Phase B-X で作成予定）」を「（N 機能、各 AC X-Y 件、Phase B-X 完了）」に変更、Tier 3 の Paper Boards / Analytics 等に Verdict ラベルを反映
- **計画書更新**: §Phase B-2（Steps 3 件 + Verification 3 件）と §Phase B-3（Steps 6 件 + Verification 2 件）を全て `[x]` に
- **MEMORY.md 更新**: 直近完了を「Phase B 完了」に集約、予定を Phase C に書換（起点ファイル / 準備済みデータ / 最初のアクションを具体化）
- **実コード整合の発見と記録**:
  - Templates の `task_templates` はレガシー残留（migrations.rs で CREATE するが CRUD コマンドなし、data_io_commands リセット時のみ DELETE 対象）→ Known Issues 記録
  - Paper Boards の Owner Provider パスは `frontend/src/components/Ideas/Connect/Paper/`（骨格の `PaperBoards/` は誤り）→ 正しいパスに修正
- **機能数サマリー**: Tier 1: 8 / Tier 2: 12 / Tier 3: 6 = 合計 **26 機能**（CLAUDE.md §11 と差分ゼロ）

### 2026-04-18 - アプリ再定義ロードマップ v2 Phase B-1 完了（Tier 1 全 8 機能要件定義）

#### 概要

Phase A（CLAUDE.md 13 章統合）に続く Phase B-1（Tier 1 コア機能の要件定義）を 1 セッションで完遂。`.claude/docs/requirements/tier-1-core.md` の事前骨格に対し、全 8 機能（Tasks / Schedule / Notes / Memo / Database / MCP Server / Cloud Sync / Terminal）の Purpose / Boundary / Acceptance Criteria（計 70 件、機能あたり 7-10 件）/ Dependencies / Known Issues / Future Enhancements を記入。各機能の Owner Provider/Module・IPC コマンド・MCP ツール対応範囲は Explore agent + grep で実コードから事実確認済。Phase B-2 (Tier 2 補助機能) / Phase B-3 (Tier 3 実験) は次セッション以降。計画書 §Phase B-1 の Steps/Verification checkbox を全て完了状態に更新。

#### 変更点

- **tier-1-core.md（379 行 → 506 行）**: 全 8 機能のテンプレ全項目を記入。`<!-- 記入予定 -->` / `<!-- AC -->` プレースホルダ残存ゼロを grep で確認
- **Tasks**: AC 10 件（階層 DnD のゾーン判定、紙吹雪、folderType='complete' 自動集約、ソフトデリート + 復元、UndoRedo、Schedule 双方向同期、MCP get_task_tree の UI 一致、カラー継承）
- **Schedule**: AC 10 件（frequencyType weekdays の自動生成、startTime 変更の既存 ScheduleItem 追従、Routine 削除カスケード、routine_logs 記録、Preview 編集、Calendar Tag、MCP list_schedule 一致、Mobile CalendarTagsProvider 省略、時間ドラッグの Tasks 同期）
- **Notes**: AC 8 件（TipTap JSON 保存、スラッシュコマンド、note_connections 双方向、Pin、パスワード保護の verify、全文検索、MCP list_notes、UI 限定削除）
- **Memo**: AC 7 件（DayFlow/DailyMemoView 表示、MCP upsert の冪等性、パスワード/ロック、TimeMemo の空保存で自動削除、Pin、UI 限定削除）
- **Database**: AC 8 件（5 種 PropertyType + config_json、Inline エディタ、フィルタ AND、Select 10 色、集計（sum/avg/min/max/countChecked）、Row DnD order_index、ソフトデリート、型変更後のキャスト）
- **MCP Server**: AC 8 件（claude コマンド自動接続、list_tasks UI 一致、create_task の UI 反映、search_all 横断、tag_entity + search_by_tag、ファイル系 7 ツール、異常終了時の本体無影響、JSON-RPC error）
- **Cloud Sync**: AC 8 件（sync_configure 保存、双方向 push/pull、last-write-wins、full_download、未対応テーブルはローカルのみ、sync_disconnect、オフライン動作、pending_changes 表示）。Status を「△基盤のみ」→「○基本完成（10 versioned + 3 relation テーブル対応、残り約 30 テーブル未対応）」に変更（sync_engine.rs の実装を読んで事実ベースに修正）
- **Terminal**: AC 8 件（Ctrl+` 開閉の SectionId 切替後維持、ドラッグで高さ調整、xterm.js 接続、claude コマンド → MCP 30 ツール認識、複数セッション、claude_state 検出、セッション終了で PTY kill、Mobile エラー返却）
- **Phase B-1 完了マーク**: `.claude/feature_plans/2026-04-18-integrated-design-roadmap.md` §Phase B-1 の Steps 6 件と Verification 3 件を `[x]` に更新
- **MEMORY.md 更新**: Phase B-1 完了を「直近の完了」に追加、「予定」を Phase B-2 / B-3 に書き換え（tier-2-supporting.md の Audio Mixer から着手する旨を記述）
- **設計判断の事実補正**: Cloud Sync の Status を実装調査で上方修正（sync_engine.rs に 13 テーブル分の push/pull ロジックが既に存在）。Tasks の Known Issues に保留 I-1（scheduled range 全件 fetch）を関連課題として追記

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

<!-- older entries archived to HISTORY-archive.md -->
