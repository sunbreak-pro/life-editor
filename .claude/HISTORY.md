# HISTORY.md - 変更履歴

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

### 2026-04-24 - iOS 追加機能要件の Phase 0〜4 / 6.1 / 6.3(Desktop) / 7 実装（計画書: ~/.claude/plans/life-editor-note-ios-calm-moth.md）

#### 概要

Note「iOS追加機能要件」(4 セクション 16 項目) の全フェーズ計画を起こし、Global (G-1/G-3/G-5)、Materials (M-5)、Calendar (C-1 / C-3 Desktop)、Work (W-1/W-2/W-3) を完遂。Phase 2.3 は初期スタブ実装からユーザー要件「ハンバーガー = Desktop rightSidebar の中身 / iOS main = 本文」に合わせて Redo。UndoRedoContext に TipTap editor 連携を追加し Mobile ヘッダー Undo/Redo が本文編集にも効くように。Title 編集の 1 文字単位 undo を 500ms debounce で 1 バーストにコアレス。Known Issue 015 として Mobile 全体の `notion-*-primary` サフィックス誤用による背景透明化バグを発見・修正（27 箇所 / 10 ファイル）。残タスク（M-1 行スワイプ / M-2/M-3 TipTap slash / C-2 filter / Mobile 5-role form）は次セッション継続。`tsc -b` 通過、Vitest 231 passed。

#### 変更点

- **Phase 0 要件 SSOT 同期**: `docs/requirements/ios-additions.md` に Materials (M-1〜M-5) / Calendar (C-1〜C-3) / Work (W-1〜W-3) セクション追記 + G-2 Status Done 化（ユーザー運用で Wi-Fi/Cellular 双方同期成功を確認）。完了したすべての AC チェック済
- **Phase 1 Global header**: `MobileLayout.tsx` のヘッダー左に `Menu` アイコン + 右に `UndoRedoButtons` 配置。`components/shared/UndoRedo/sectionDomains.ts` を新設し Desktop TitleBar と共通化、Mobile 省略 domain（playlist / sound / settings）は `getMobileUndoDomains` で自動除外
- **Phase 2 左ドロワー + 戻るジェスチャー**: `MobileLeftDrawer.tsx` / `useSectionHistory.ts` / `useEdgeSwipeBack.ts` 新設。左スライドイン、背景タップ / 左スワイプで閉じる、左端 24px 起点右スワイプで `activeSection` スタックを pop（ProseMirror / `data-no-edge-swipe` でガード）
- **Phase 2.3-Redo (ユーザー要件反映)**: MobileApp を「main = `DailyView`/`NotesView`/`MobileCalendarView`/`MobileWorkView`、drawer = `DailySidebar`/`MaterialsSidebar`/`WorkSidebarInfo`」の 2 スロット構造に再構成。Desktop sidebar コンポーネントを props 直接供給で Mobile drawer に埋め込み、各 Context を MobileApp が consume して選択状態を下流へ。drawer で note/date タップ → drawer 自動クローズ → main がエディタ表示。Navigation リストはユーザー要望で削除
- **Provider Optional 化**: `DailyView` / `NotesView` の `useScreenLockContext` → `Optional` + null fallback `{ isUnlocked: () => true, unlock: () => {} }`。`WorkSidebarInfo` の `useAudioContext` → `Optional` + Audio セクション（Now Playing / PlaylistSelectPopover）を null ガード。Desktop 挙動は fallback 値で従来通り（Provider が null でないため）
- **UndoRedoContext に editor 連携追加**: `setActiveEditor` / `getActiveEditor` API を `UndoRedoContextValue` に追加、`RichTextEditor` が `onFocus` で自身を登録し unmount 時に解除（自分が active のときのみ）。`UndoRedoButtons` はアクティブ editor が存在 + `can().undo()` なら `editor.commands.undo()` を優先、それ以外は domain スタック。Desktop の Cmd+Z は従来通り、Mobile ヘッダー Undo が本文編集にも効く
- **NotesView タイトル 500ms debounce**: `handleTitleChange` を local `titleDraft` state + `window.setTimeout(..., 500)` で debounce。note 切替時は `titleDraftNoteIdRef` で resync、onBlur で即時フラッシュ。1 文字単位の undo エントリ量産を解消
- **Phase 4 M-5**: `utils/tiptapText.ts` に `extractFirstHeading(content)` 追加（再帰的に heading ノードを探索）。`NoteTreeNode` の表示タイトル導出を「本文先頭 heading → `note.title` → "Untitled"」の順に変更（Desktop / Mobile 共通反映）
- **Phase 6 C-1**: `MobileCalendarView` の月グリッドに `onTouchStart/Move/End` を実装、60px threshold で前月/翌月へ。Chevron ボタンと併存、中央スワイプのみ検知で G-5 Edge Swipe と衝突なし
- **Phase 6 C-3 (Desktop)**: `CreateItemPopover` に Routine 項目追加（`onSelectRoutine` prop、未提供時は自動非表示の安全設計）。`CalendarView` が `createRoutine("Untitled routine")` を呼ぶようワイヤリング。i18n `calendar.createRoutine` / `newRoutinePlaceholder` 追加。Mobile `MobileScheduleItemForm` への 5-role 化は別 PR（現状 event 専用フォーム）
- **Phase 7 W-1**: Task Picker 背景は Known Issue 015 の `bg-notion-bg-primary` → `bg-notion-bg` 置換で既に solid 化済（Note の不透明化要件を自動達成）
- **Phase 7 W-2**: `timerReducer` に `SET_SESSION_TYPE` action 追加（isRunning=false / sessionType 切替 / remainingSeconds を新タイプの duration に reset）。`TimerContext` に `setSessionType` API 追加。`MobileWorkView.onSwitchSession` を `timer.setSessionType(next)` に置換。タブタップは sessionType 切替のみで start/stop はトリガーしない → Long Break 再タップ後のトグルループを解消
- **Phase 7 W-3**: `SessionTabs` をコンパクト版（ラベルのみ、sub-minutes 削除）にリファクタし、トップバー右寄せに移動。Timer Arc 真上の占有を解消
- **Phase 8 ドキュメント**: `ios-additions.md` の各 AC を Done/Partial に更新、HISTORY.md にセッションサマリ追加、MEMORY.md に「Mobile notion-\*-primary 罠」メモ追加
- **Known Issue 015 起票**: `docs/known-issues/015-mobile-invalid-tailwind-primary-suffix.md` — 10 ファイル 27 箇所で存在しない Tailwind class `bg-notion-bg-primary` / `text-notion-text-primary` を使用、Tailwind v4 は未定義クラスを silent skip するため透明化・既定テキスト色にフォールバックしていた。Index.md に Fixed 1 件追加、Category Styling 新設
- **プランファイル更新**: `~/.claude/plans/life-editor-note-ios-calm-moth.md` の Phase 1 / 2 / 2.3-Redo を完了マーク、残タスク（M-1 / M-2/M-3 / C-2 / Mobile 5-role）は Pending として継続
- **Verification**: `npx tsc -b --force` 通過、`npx vitest run` 231 passed (29 files)。実機 iOS で G-1/G-3/G-5 および Materials drawer → editor 切替、タイトル debounce、本文 undo ともユーザー確認済

#### 残課題

- **M-1 行スワイプ**: NoteTreeNode の既存 DnD / hover UI と touch スワイプが干渉するため touch-UX 専用設計が必要。別 PR
- **M-2 / M-3 TipTap slash command**: `@tiptap/suggestion` 依存追加 + ポップオーバー UI 新規実装が必要。別 PR
- **C-2 Calendar filter / sort**: role multi-select + sort UI の design が必要。drawer 内 filter sheet として実装予定
- **Mobile 5-role 対応 (C-3)**: `MobileScheduleItemForm` を role 選択対応にリファクタ（現状 event 専用）
- **Mobile M-1 行スワイプ**: 現行 drawer で使う `MaterialsSidebar` / `DailySidebar` の行コンポーネントに右→左スワイプで edit/pin/delete 表示を追加

