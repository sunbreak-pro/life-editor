# HISTORY.md - 変更履歴

### 2026-04-25 - リファクタリング Phase 2-3a TaskDetailPanel 分割完了（4 sibling files 抽出）

#### 概要

Phase 2 の最初の巨大コンポーネント分割。`frontend/src/components/Tasks/TaskDetail/TaskDetailPanel.tsx` を 947→55 行に縮約し、内部の 4 サブコンポーネントを sibling ファイルに抽出。`InlineEditableHeading` は `components/shared/EditableTitle`（controlled input）と用途違いのため別名で sibling 化、外部の 3 import 経路（`TaskTreeView`, `ScheduleTasksContent`）は path 不変。動作影響ゼロ、`tsc -b` 通過 + Vitest 257/257（pre-existing sidebar-tags + free-pomodoro WIP を stash した clean state で確認）。1 commit (`661b370`)。Phase 2-3 残 3 コンポーネント (ScheduleTimeGrid 1220 / OneDaySchedule 1165 / TagGraphView 1443) は次セッション以降、1 セッション 1 ファイル + 手動 UI 検証必須。

#### 変更点

- **InlineEditableHeading.tsx**(76 行) 新設 — 旧 local `EditableTitle` (TaskDetailPanel.tsx 内部関数) を抽出、`shared/EditableTitle.tsx`（controlled input）との用途違いを明示するため rename。click-to-edit で `<h2>` ↔ `<input>` を内部 state で切替するヘディングコンポーネント。Enter/blur 保存、Escape キャンセル、trim 後空文字なら revert
- **DebouncedTextarea.tsx**(62 行) 新設 — 旧 local `DebouncedTextarea`（500ms debounce + on-unmount flush）を抽出。Task / Folder 両エディタの description 入力で共有
- **TaskSidebarContent.tsx**(244 行) 新設 — 旧 local `TaskSidebarContent` を抽出。breadcrumb（先祖アイコン編集）/ status icon / inline title / WikiTagList / RoleSwitcher（task↔event/note/daily 変換）/ priority / DateTimeRange / reminder / time memo / 削除ボタン。`TaskRoleSwitcherRow` は使用箇所 1 つのため file 内 inline 維持
- **FolderSidebarContent.tsx**(536 行) 新設 — 旧 local `FolderSidebarContent` を抽出。breadcrumb + folder icon picker / inline title / Schedule トグル / MiniCalendarGrid / DebouncedTextarea (memo) / 3-tier 子ノード一覧（child folders → child tasks → complete folders）。Complete folder の子は line-through 装飾、子の status トグルで confetti + sound effect
- **TaskDetailPanel.tsx** 947 → 55 行 — `useTaskTreeContext` から最低限の data + handlers を取得し、`!node` → TaskDetailEmpty / `node.type === "task"` → TaskSidebarContent / else → FolderSidebarContent にディスパッチするだけ。外部 import 不変（`TaskTreeView.tsx:7` / `ScheduleTasksContent.tsx:6` の path `./TaskDetail/TaskDetailPanel` が引き続き有効）
- **行数推移**: 947 → 55 + 76 + 62 + 244 + 536 = 973 行（+26 行は doc コメント + 各ファイルの import 重複分。型 / 責任 / テスト容易性のトレードで受領）
- **Verification**: `cd frontend && npx tsc -b` exit 0 / `npm run test` 257/257 passed（CalendarTagsPanel 関連 13 失敗は事前検証で sidebar-tags WIP 由来と確認、stash 後 clean state で全件 pass）

#### 残課題

- **Phase 2-3b ScheduleTimeGrid** (1220 行) — DnD + grid layer 多数、最も複雑。`ScheduleTimeGrid/{index,GridLayer,EventLayer,DragHandlers,Hooks}.tsx` の sub-directory 構造を計画
- **Phase 2-3c OneDaySchedule** (1165 行) — 1 関数内に多数の useState/useCallback。`useDayFlowFilters` / `useDayFlowDialogs` カスタムフック抽出 + render 専念 component の構造に
- **Phase 2-3d TagGraphView** (1443 行) — force layout + canvas 描画 + interaction が混在
- **Phase 2-1 migrations.rs / 2-2 TauriDataService.ts**: WIP（sidebar-tags-free-pomodoro）が両ファイルに +103 / +30 行追加中で衝突するため、WIP commit 後でないと着手不可
- **手動 UI 確認**: TaskDetail サイドバーの 6 機能（task 編集 / folder 編集 / breadcrumb 先祖アイコン編集 / inline title / RoleSwitcher 変換 / 子フォルダ展開）が次回 `cargo tauri dev` で回帰なしか確認

---

### 2026-04-25 - リファクタリング Phase 1 完了（Cloud sync split / Provider tree 抽出 / row_to_json 統合 / SAFETY コメント）

#### 概要

Phase 0 完了直後に Phase 1 を 1 セッションで全 4 step（1-1〜1-4）完遂。Cloud Worker の責務分離 + セキュリティ強化、Frontend Provider tree 抽出、Rust 側の row→JSON 重複統合と SQL 識別子補間の SAFETY コメント明示化。3 commits（cloud / frontend / rust）。`tsc -b` 通過 / `cargo check --lib` 通過 / `wrangler deploy --dry-run` で bundle 199.95 KiB / 38.82 KiB gzip / Vitest 257/257 pass（pre-existing sidebar-tags WIP を stash した clean state で確認）。動作影響ゼロのリファクタ。

#### 変更点

- **Phase 1-1 Cloud sync.ts 責務分割**: `cloud/src/routes/sync.ts` 459 行を `routes/sync/index.ts`（Hono オーケストレータ）/ `routes/sync/shared.ts`（toCamelCase / quoteCol / topoSortByParent / `buildStampStatement` ヘルパ）/ `routes/sync/versioned.ts`（VERSIONED*TABLES の pull/push + schedule_items 重複排除 / tasks topo sort）/ `routes/sync/relations.ts`（relation tables の pull/push、`RELATION_PARENT_JOINS` table-driven config 化）+ `cloud/src/config/syncTables.ts`（VERSIONED_TABLES / PRIMARY_KEYS / RELATION*\*\_TABLES / RELATION_PARENT_JOINS / SYNC_PAGE_SIZE 集約）+ `cloud/src/utils/schema.ts`（zod `PushBodySchema` で /sync/push body 検証）の 6 ファイル分割。`buildStampStatement` で versioned / relation の両 push 経路に重複していた server_updated_at UPDATE 文の組み立てを 1 箇所に集約
- **Phase 1-1 セキュリティ強化**: `cloud/src/middleware/auth.ts` の Bearer token 比較を `===` から SHA-256 + `crypto.subtle.timingSafeEqual` に置換。タイミング攻撃で SYNC_TOKEN の長さや先頭一致バイトが漏洩する経路を遮断。raw-SQL 識別子補間箇所すべて（`SELECT * FROM ${table}` / `INSERT INTO ${table}` / 等）に `// SAFETY:` コメントで whitelist source を明記
- **Phase 1-2 Provider tree 抽出**: `frontend/src/main.tsx` 97→38 行。新設 `frontend/src/providers/DesktopProviders.tsx`（15 層）/ `MobileProviders.tsx`（10 層）に Provider 木を移送、外殻（ErrorBoundary / Theme / Toast / Sync）のみ main.tsx に残置。両ファイルに「order is load-bearing — see CLAUDE.md §6.2」と Provider 順依存性を明記。**ドキュメント乖離発見**: CLAUDE.md §6.2 では「Mobile は WikiTag を省く」と記載されているが、実コード（旧 main.tsx 含む）は Mobile でも WikiTagProvider を含む。今回は既存挙動踏襲（=テスト 257/257 維持）、CLAUDE.md 修正は別タスクで処理予定
- **Phase 1-3 Rust row_to_json 統合**: `src-tauri/src/db/row_converter.rs` を新設し `pub fn row_to_json(row, col_names) -> serde_json::Value` を集約。`db/helpers.rs:130` と `sync/sync_engine.rs:181` の byte-equivalent な local fn を削除し re-import に切替。NULL/INTEGER/REAL/TEXT/BLOB → JSON Value のマッピング契約を 1 箇所で文書化
- **Phase 1-4 SQL injection 防御の明示化**: `sync_engine.rs::collect_all` の VERSIONED_TABLES / RELATION_TABLES_WITH_UPDATED_AT 反復ループ直前に `// SAFETY: const slice 反復、never from caller input` コメント追加（lines 94 / 100 周辺）。`db/helpers.rs::next_order` の doc-comment に「callers MUST pass a static table-name literal」契約を明記。`debug_assert!(is_known_table)` は構造的に冗長（呼出元はすべて const slice or repository 内静的リテラル）と判断し不採用
- **Verification**: `cloud && npx tsc --noEmit` 通過 / `cloud && wrangler deploy --dry-run` bundle 成功（199.95 KiB / gzip 38.82 KiB） / `frontend && npx tsc -b` 通過 / `frontend && npm run test` 257/257 pass（CalendarTagsPanel 関連の 10 件失敗は pre-existing sidebar-tags WIP 由来 → WIP stash 後 clean state で全件 pass 確認） / `src-tauri && cargo check --lib` 通過
- **commits（3 本）**: `599133e refactor(cloud): split sync.ts into versioned/relations/shared + zod + timing-safe auth` (10 files / +759/-462) / `ecbc192 refactor(frontend): extract DesktopProviders / MobileProviders from main.tsx` (3 files / +122/-68) / `63799a6 refactor(rust): consolidate row_to_json into db::row_converter + SAFETY comments` (4 files / +60/-38)
- **計画書見立てとの乖離記録**: 当初計画 -500〜-800 行に対し実績 +373 行。理由は (1) zod / timing-safe / 6 ファイル分割の各先頭に module purpose / SAFETY コメント追加 / RELATION_PARENT_JOINS の table-driven 化で増加 (2) `buildStampStatement` の重複解消は -10 行程度のみ。LOC 増加と引き換えに型 + SAFETY 契約 + 単一責任の三点が明文化されたため、減ではなく構造改善として受領

#### 残課題

- **Phase 2 (中期 4-6 セッション、推定 -1500〜-2500 行)**: `migrations.rs` (2328 行) を V1-V30 / V31-V60 / V61-V64 の 3 分割 / `TauriDataService.ts` (1453 行) を domain ごとに分割 / 巨大コンポーネント 4 件分割 / Calendar Mobile-Desktop 統合
- **Phase 3 (長期 6-10 セッション、推定 -2000〜-4000 行)**: Rust 27 repository の `row_to_model` 統一 trait 化 / Issue 012 cursor pagination 本実装 / `Schedule/` rename / 論理キー UNIQUE migration（V65+）
- **手動 UI 確認**: `cargo tauri dev` 起動で Provider tree 抽出後の Desktop / Mobile 両方の動作確認（Schedule / Calendar / Timer / Audio / WikiTag）
- **既存 lint 116 問題**: 別セッションで対応継続
- **CLAUDE.md §6.2 と実コードの WikiTag 乖離**: 別タスクで「文書を実コードに合わせる or 実コードを文書に合わせる」を判定

---

### 2026-04-25 - リファクタリング Phase 0 完了（@deprecated 整理 + formatTime 統合 + tiptap XSS 緩和 + MEMORY.md 整理）

#### 概要

3 subsystem (Frontend / Rust / Cloud) を中粒度で並列分析し、4-Phase の段階的リファクタリング計画を策定。Phase 0 (Quick Wins) として @deprecated 4 件削除 / formatTime 真の重複 1 箇所統合 / tiptapText.ts の innerHTML XSS 経路の DOMParser 化 / MEMORY.md §バグの温床の重複行削除を実行。動作影響ゼロ、検証は `tsc -b` 通過 / Vitest 255 passed (31 files) / `@deprecated` grep 0 件。-58 行 / 7 ファイル変更 / 5 commits（origin/main から 5 commits ahead、push 未実施）。当初 Frontend Explore agent が報告した「formatTime 重複 18+ 箇所」は実態 1 箇所のみで、4 シグネチャの責務違い別関数が並存しているだけと精査で判明し、agent ベースの DRY 検出はシグネチャ照合をしないため過剰検出する旨を `code-inventory.md §3.1` と `refactoring-plan.md` Phase 0-2 に記録。

#### 変更点

- **新規 doc 2 ファイル**: `.claude/2026-04-25-refactoring-plan.md`（Phase 0-3 実行計画 / Status: IN_PROGRESS / Phase 0 完了マーク + 規模感テーブルに実績反映）+ `.claude/docs/code-inventory.md`（Active / Frozen / Duplicate / Risk Hotspot 棚卸し / Active Issue 0 / Monitoring 1 / Fixed 8 を反映、§3.1 で formatter 統合の見積もり乖離を記録）
- **Phase 0-1 @deprecated 4 件削除**: `frontend/src/context/ScheduleContextValue.ts` を完全削除（参照ゼロ確認後）+ `context/index.ts` re-export 削除 / `components/Tasks/Schedule/DayFlow/GroupFrame.tsx` の `onDoubleClick` prop と関連 onDoubleClick handler を削除（caller `ScheduleTimeGrid.tsx` / `MobileDayflowGrid.tsx` ともに onClick のみ使用）/ `components/shared/UndoRedo/UndoRedoButtons.tsx` の `domain` prop 削除（caller `TitleBar.tsx` / `MobileLayout.tsx` 双方とも `domains` 複数形のみ使用）。grep で `@deprecated` 4→0 件
- **Phase 0-2 formatTime ローカル関数統合**: `components/Schedule/ScheduleItemEditPopup.tsx:52` のローカル `formatTime(h, m)` を削除し `utils/timeGridUtils.ts::formatTime` から import に置換。当初計画「dateFormat.ts 新設で 18+ 箇所統合」は精査結果（4 シグネチャの別関数並存: `(dateStr)` / `(h, m)` / `(seconds)` / Pomodoro Context method）により縮小、真の重複 1 箇所のみ統合
- **Phase 0-3 tiptapText.ts XSS 緩和**: `utils/tiptapText.ts::getContentPreview` の JSON parse 失敗時 fallback を `tmp.innerHTML = content` から `DOMParser.parseFromString(content, "text/html")` ベースに変更。`<img onerror>` / `<script>` / `<iframe>` 経由の attribute / inline JS 経路を inert document 化で除去。well-formed legacy HTML の動作は不変
- **Phase 0-4 MEMORY.md §バグの温床 整理**: 旧行 102-112 を削除（行 103-111 は行 90-100 の単純重複コピー、行 112 「Cloud D1 migration 未適用」は 2026-04-24 の migration 0003 適用済で陳腐化）。17 → 16 ユニーク項目に
- **Verification**: `npx tsc -b` 通過 / `npm run test` 255/255 pass (31 files、`tiptapText.test.ts` 13 件 / `sectionDomains.test.ts` 8 件 / `timerReducer.test.ts` 32 件含む既存テストすべて) / `grep @deprecated frontend/src` 0 件 / 手動 UI 確認は次セッション dev 起動時
- **commits（5 本）**: `76c6591` docs(plan + inventory) +562 行 / `991b5bf` refactor(@deprecated 削除) -44 行 / `36b2de7` refactor(formatTime 統合) -3 行 / `cd8d59e` fix(tiptapText XSS) +0/-0 / `4f2d552` docs(MEMORY.md dedup) -11 行
- **教訓 (`code-inventory.md §3.1` / `refactoring-plan.md` Phase 0-2 に記録)**: agent ベースの DRY 違反検出はシグネチャまで照合しないため過剰検出する。formatTime「18+ 箇所」と Frontend Explore agent が報告したが、実態は 4 シグネチャの責務違い別関数並存で **真の重複は 1 箇所のみ**だった。リファクタリング計画は実装着手時に必ず精査する運用が要る

#### 残課題

- **Phase 1 (別セッション)**: Cloud `routes/sync.ts` 責務分割（Issue 012 cursor pagination の前提地ならし）/ `frontend/src/main.tsx` Provider tree 共通化（`<DesktopProviders>` / `<MobileProviders>` 抽出）/ Rust `helpers.rs` と `sync_engine.rs:177` の `row_to_json` 重複統合 (`db/row_converter.rs` 新設) / SQL injection whitelist の SAFETY コメント明示化（推定 -500〜-800 行）
- **Phase 2-3 (中長期)**: `migrations.rs` (2328 行) を V1-V30 / V31-V60 / V61-V64 に 3 分割 / `TauriDataService.ts` (1453 行) を domain ごとに分割 / 巨大コンポーネント 4 件（ScheduleTimeGrid / OneDaySchedule / TagGraphView / TaskDetailPanel）を index + サブコンポーネント構造に / Calendar Mobile-Desktop 統合（`useCalendarViewLogic` + shared component）/ Rust 27 repository の `row_to_model` 統一 trait 化 / 012 cursor pagination 本実装 / `Schedule/` → `ScheduleList/` rename / 論理キー UNIQUE migration（V65+）
- **手動 UI 確認**: Schedule UI / Mobile Calendar / Timer 表示で時刻フォーマット崩れなし確認（次回 `cargo tauri dev` 時）
- **既存 lint 116 問題の解消**: 別セッションで対応継続（本 Phase スコープ外）
- **`git push`**: ユーザー判断で未実施（origin/main から 5 commits ahead）

---

### 2026-04-25 - Known Issues 統合（13→9）+ CLAUDE.md / rules ディレクトリのコンパクト化

#### 概要

ドキュメント整理セッション。コンテキスト消費の現状分析（自動ロード ~8.4K tok/turn）に基づき、known-issues 13 ファイルを 9 ファイルに統合（旧 001/002/003 → 新 001、旧 013/014 → 新 013）し、CLAUDE.md / `~/.claude/rules` を 20-23% 圧縮。月間 ~342K tok 節約見込み。コード変更ゼロ、ドキュメント整合性は session-verifier Gate 5 で検証済（INDEX 参照と実ファイル完全一致 / CLAUDE.md・rules・vision に旧 ID 参照ゼロ）。

#### 変更点

- **Known Issues 統合**: 旧 001(SQL 予約語) / 002(FK 制約順序) / 003(template_id schema drift) を `001-cloud-sync-bootstrap-schema-fk.md` に統合（2026-04-18 セッションの 3 連戦） / 旧 013(timestamp 形式混在) / 014(非単調 updated_at) を `013-delta-sync-cursor-design-flaws.md` に統合（delta sync cursor 設計の 2 つの根本欠陥として因果連鎖を 1 ファイルに集約）
- **Known Issues 各ファイルの圧縮**: 残った 7 ファイル（004 / 005 / 006 / 007 / 008 / 011 / 012 / 015）の冗長表現を刈り込み、平均 21% 削減。Symptom / Root Cause / Lessons の重複言い換えを統合し、コード参照は path:line 形式のみに整理
- **INDEX.md 再構成**: 統合後 9 件構成に書き換え。Status 集計を Active 0 / Monitoring 1 / Fixed 8 / 合計 9 件に更新、Category 別索引も再生成。「統合履歴」節を追加して旧→新の追跡を可能に
- **CLAUDE.md コンパクト化**(20,351→15,597 B、350→267 行、-23%): §0 関連ドキュメント表を 1 行リスト化 / §3.1 全体構成 ASCII art を横書き圧縮 / §4.1 V60〜V64 migration 履歴を 1 段落に集約 + `014-*.md` 旧参照を `013-*.md` に修正 / §5.1 MCP 30 ツール表をドメイン別箇条書きに / §8 Feature Tier 3 段見出しを箇条書き 1 段に圧縮 / §9 ADR を使わない理由を 1 段落に集約
- **`~/.claude/rules/` コンパクト化**(5,602→4,380 B、-22%): `skill-management.md` の Archive 運用節を 3 案 1 行ずつに圧縮 / `plan-mode-quality.md` の Workflow Chain を冗長英文から箇条書きへ / `conversation-workflow.md` を箇条書き整理。`session-start.md` / `tool-usage.md` / `skill-launch.md` は元々小さく touch せず
- **コンテキスト消費削減効果（試算）**: 自動ロード分が 1 turn あたり -5,976 bytes ≈ -1,710 tokens。200 turn/月想定で **月間 ~342,000 tokens 削減**（旧 1.79M → 新 1.45M tok/月）
- **Verification (session-verifier Gate 5)**: INDEX 参照と実ファイル 9 件完全一致を確認。CLAUDE.md / rules / vision/ に旧 issue ID（014-\* / 旧 001-003 含む）への参照残存ゼロを 5 種の grep で確認。HISTORY.md / archive/ 内の旧参照は履歴記録として正当（修正対象外）
- **Stage C 見送り**: HISTORY-archive.md の圧縮（30KB → 5KB）は ROI 低（月 ~18K tok しか食わない）と判定し見送り

---

### 2026-04-25 - iOS 追加機能要件 セッション後の品質ゲート（lint / test coverage / bug pattern）

#### 概要

2026-04-24 セッションで追加した Mobile 関連コードに対し、session-verifier で React Compiler 起因の lint エラー 4 件を解消し、純粋関数 / hooks に対するユニットテストを 24 件追加。`useEdgeSwipeBack` の listener 再登録問題も合わせて修正。実機挙動には影響しないリファクタとテスト追加のみで、Vitest 255 passed (31 files)。今後の残タスク (M-1 行スワイプ / M-2/M-3 TipTap slash / C-2 filter / Mobile 5-role form) は MEMORY.md と plan ファイルに継続記録。

#### 変更点

- **DailyView / NotesView の Optional Provider fallback 安定化**: `screenLock?.unlock ?? (() => {})` パターンが毎レンダーで新しい関数参照を生成し React Compiler に "useCallback dependency unstable" 警告を出していた問題を、module-scope の `SCREEN_LOCK_FALLBACK = { isUnlocked: () => true, unlock: () => {} } as const` に置換することで解消（DailyView / NotesView の 2 ファイル）
- **NotesView title resync の "setState in effect" 警告解消**: `useEffect(() => setTitleDraft(...), [selectedNote?.id])` の cascading-render 警告を、React 推奨の "adjust state on prop change during render" パターン（`if (titleDraftNoteId !== currentNoteId) setTitleDraft(...)`）に置換。同時に不要だった `titleDraftNoteIdRef` ref と空の cleanup useEffect を削除し、ハンドラは `selectedNote?.id` を直接参照
- **MobileLeftDrawer の mount/unmount setTimeout pattern 廃止**: アニメーション後の delayed unmount 用 `mounted` state + `setTimeout(setMounted(false), 220)` を、常時 DOM レンダー + `pointer-events-none` + `aria-hidden` で代替。cascading render 警告を解消、コードも簡素化
- **useEdgeSwipeBack listener 再登録の最適化**: `isBlocked: () => isDrawerOpen` のような inline callback が毎レンダー参照変化することで `useEffect` deps が常時 invalidate されて touch listener を再アタッチしていた問題を、latest-callback ref パターン（`onSwipeBackRef` / `isBlockedRef` を render phase で更新、effect は `enabled / edgeWidthPx / thresholdPx` のみ依存）で解消
- **新規テスト 24 件追加（純粋関数優先で max 3 ファイル）**:
  - `frontend/src/utils/tiptapText.test.ts` (新規, 13 tests): `extractFirstHeading` の happy path / nested content 探索 / 順序保証 / heading なし / 空白のみ / 空入力 / invalid JSON、および既存 `extractTextFromTipTap` / `getContentPreview` の基本ケース
  - `frontend/src/components/shared/UndoRedo/sectionDomains.test.ts` (新規, 8 tests): `SECTION_UNDO_DOMAINS` のセクション網羅、`getMobileUndoDomains` の Mobile 省略 domain (playlist / sound / settings) フィルタ動作、未マップセクション (terminal / analytics) の空配列返却
  - `frontend/src/context/timerReducer.test.ts` 拡張 (3 tests追加): W-2 修正で導入した `SET_SESSION_TYPE` action の動作確認（sessionType 切替 + isRunning=false + remainingSeconds reset / completion modal 解除 / 同 sessionType 再ディスパッチ regression）
- **Verification**: `npx tsc -b` 0 errors / `npm run test` 255 passed (31 test files, 24 new). 残る 5 件の lint error は git blame で 2026-04-11 / 2026-04-18 由来の pre-existing と確認済（NoteTreeNode 297 / CalendarView 371,386,401 / RichTextEditor 456）、MEMORY.md「Frontend 既存 lint 116 問題の一括解消」として既登録のため本セッションでは touch せず

---
