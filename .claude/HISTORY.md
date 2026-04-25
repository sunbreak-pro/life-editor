# HISTORY.md - 変更履歴

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

---

### 2026-04-24 - Cloud Sync 014 本命修正 — server_updated_at cursor 導入（計画書: archive/2026-04-24-014-server-updated-at-cursor.md）

#### 概要

delta sync が updated_at の非単調性で破綻する構造バグ（Known Issue 014）を Option A で根本解消。Cloud D1 に `server_updated_at` 列を追加し、Worker `/sync/push` は版 LWW で UPSERT が棄却されても必ず stamp を進める 2 文方式に改修、`/sync/changes` は全 delta query を `server_updated_at` cursor に切替。これで「Mobile 11:50 編集 v=372 + Desktop 13:30 編集 v=228」のような高 version + 古 updated_at 行でも、棄却された push 側のデバイスが次回 pull で Cloud の最新版を確実に受け取れる。Client（Rust / Frontend）は無変更で API 契約維持。Production D1 migration 適用（39 queries / 2174 rows backfilled）+ Worker 再 deploy（Version `38987e73-677c-43e9-9fab-52cb0ea7ca49`）。014 を Monitoring → Fixed 化し db-conventions §3 を全面更新。cloud tsc 0 error。

#### 変更点

- **Cloud D1 migration 0003**: `cloud/db/migrations/0003_add_server_updated_at.sql` 新規作成。versioned 10 テーブル（tasks / dailies / notes / calendars / routines / schedule*items / wiki_tags / time_memos / templates / routine_groups）と relation-with-updated_at 3 テーブル（wiki_tag_assignments / wiki_tag_connections / note_connections）に `server_updated_at TEXT` を ALTER TABLE ADD COLUMN、`UPDATE ... SET server_updated_at = updated_at WHERE server_updated_at IS NULL` で既存行を backfill（初回 /sync/changes の過剰噴出を防ぐため updated_at 値をそのまま移植）、`CREATE INDEX IF NOT EXISTS idx*<table>\_server_updated_at` 13 本を追加
- **Cloud schema.sql 整合**: `cloud/db/schema.sql` の CREATE TABLE 13 個と末尾 index ブロックに `server_updated_at TEXT` + 13 index を追記、migration 後の最終形と同一に維持
- **Worker `/sync/push` 2 文方式（014 本命）**: `cloud/src/routes/sync.ts::sync.post("/push")` で `serverNow = new Date().toISOString()` を batch 先頭で 1 回決定し、versioned tables の UPSERT 文の直後に `UPDATE <table> SET server_updated_at = ?serverNow WHERE <pk> = ?` を必ず push。relation-with-updated_at 3 テーブルも同様（複合 PK `wiki_tag_assignments (tag_id, entity_id)` に対応する `RELATION_PK_COLS` map を新設）。これにより `ON CONFLICT(id) DO UPDATE ... WHERE excluded.version > table.version` で UPDATE が丸ごと棄却される版 LWW ケースでも cursor だけは確実に進む
- **Worker `/sync/changes` cursor 切替**: 同ファイルの versioned / relation-with-updated_at / 親 join 3 箇所（calendar_tag_assignments→schedule_items / routine_tag_assignments→routines / routine_group_tag_assignments→routine_groups）全てで `WHERE datetime(updated_at) > datetime(?since)` を `WHERE datetime(server_updated_at) > datetime(?since)` に置換、`ORDER BY` も `datetime(server_updated_at) ASC` に統一。`datetime()` wrap は 013 修正で入れた ISO/space 両形式対応をそのまま維持
- **Production D1 migration 適用**: `npx wrangler d1 execute life-editor-sync --remote --file=./db/migrations/0003_add_server_updated_at.sql` で 39 queries 成功 / 2174 rows 書き込み / 全主要テーブル null_cnt=0 を UNION ALL 診断で確認。唯一 `wiki_tag_assignments` に元々 `updated_at` が NULL だった 14 行が残ったため `UPDATE SET server_updated_at = '1970-01-01T00:00:00.000Z' WHERE server_updated_at IS NULL` で追加補修
- **Worker 再 deploy**: `npx wrangler deploy` で Version `38987e73-677c-43e9-9fab-52cb0ea7ca49` を公開。401 応答（認証前）で endpoint 正常性を確認
- **Known Issue 014 Fixed 化**: `.claude/docs/known-issues/014-delta-sync-nonmonotonic-updated-at.md` の Status を Monitoring → Fixed、Resolved=2026-04-24、Fix セクションを「migration 0003 / 2 文方式 / cursor 切替 / Deploy 順序」の 4 ブロックで全面書き換え。Lessons Learned に「棄却された push こそ server_updated_at を進めなければならない」「relation テーブルの NULL updated_at バックフィルの罠」「Migration → Worker deploy 逆不可」の 3 項目を追加
- **INDEX.md 更新**: 014 を Monitoring table から削除し Fixed table に追加（Resolved 2026-04-24）、Status 集計を Monitoring 1 件(006) / Fixed 11 件 / 合計 12 件に修正（012 を Monitoring に誤計上していた旧集計も訂正）
- **db-conventions.md §3 全面書き換え**: 「delta sync cursor は `server_updated_at`（2026-04-24 から）」として新設計を正面に据える構成に変更。`push 時の stamp を落とさない` / `Full Re-sync を緊急弁として残す` / `両端 (id, version) 一致判定` / `relation backfill の NULL 罠` の 4 運用ルールを詳述。§9 今後の作業から 014 を削除し「完了済み（履歴）」サブセクションに移動
- **CLAUDE.md §4.1 更新**: V64 migration 履歴の直後に「Cloud D1 側は 2026-04-24 に migration 0003 で `server_updated_at` 列を追加（delta sync cursor 用）。Desktop SQLite には存在しない Cloud 専用列」の 1 行を追加、known-issues/014 と db-conventions.md §3 への誘導リンクを明記
- **Session-verifier 実行**: Gate 1 Types（tsc --noEmit exit=0） / Gate 2 Lint（cloud/ に script なしスキップ） / Gate 3 Tests（cloud/ にテストインフラなしスキップ） / Gate 5 Structural（DB 命名 / migration ルール準拠） / Gate 6 Bug Scan（serverNow は batch 先頭で固定 / 2 文目 UPDATE は INSERT 直後で pk ヒット保証 / SQL パラメータは全て `.bind()`）全 PASS
- **残課題（別セッション、db-conventions §9 優先度順）**: (1) `datetime('now')` 使用箇所を `helpers::now()` / `new Date().toISOString()` 経由に全置換（013 恒久）/ (2) Mobile Settings に Full Re-sync ボタン追加 / (3) `/sync/changes` cursor-based pagination 本命実装（012 本命）/ (4) Desktop `migrations.rs` と `cloud/db/schema.sql` の drift 検出 CI

---

### 2026-04-24 - Cloud Sync timestamp 整合性修正（Known Issues 013 / 014）+ DB 規約 vision 新設

#### 概要

Mobile からの Note 書き込みが Desktop に届かない症状を調査し、3 層の根本原因を解消。(1) Cloud D1 未 migration で Worker だけ新コードに deploy され batch 全 rollback で silent 失敗していた状態を、`cloud/db/migrations/0002_rename_memos_to_dailies.sql` を Cloud schema に合わせて書き直し本番適用。(2) sync 比較が raw string `>` でスペース区切り (`2026-04-23 12:37:31`) と ISO 8601 (`2026-04-23T12:42:12.496Z`) の混在により ASCII 順 space(0x20) < T(0x54) の罠で同日 space 行が delta から凍結していた問題を、`sync_engine.rs` / `cloud/src/routes/sync.ts` の delta query 全てを `datetime(...)` 正規化し Known Issue 013 として Fixed 起票 + regression test 2 本追加。(3) delta sync が updated_at 単調性に依存、Mobile 高 version 古 updated_at 行が pull 不能になる構造的制約は Full Re-sync を緊急弁とする暫定対応で Known Issue 014 (Monitoring) として起票（本命は Cloud D1 `server_updated_at` 列追加で別セッション）。並行して DB 操作規約 `docs/vision/db-conventions.md` を新設し、CLAUDE.md / MEMORY.md / auto-memory / known-issues INDEX も整合更新。cargo test 11 → 13 pass / Cloud tsc 0 / clippy 新規 warning 0 / Worker 再 deploy（Version `04d24d88-3e16-4abd-9322-7d2377c22991`）。

#### 変更点

- **Cloud D1 本番 migration 適用**: `cloud/db/migrations/0002_rename_memos_to_dailies.sql` を Cloud schema に存在しない `note_links` / `paper_nodes` 参照を除去し、`wiki_tag_assignments` の PK `(tag_id, entity_id)` 衝突（Desktop V64 済み端末が既に push していた `daily-*` 行と migration が `memo-*` から生成する `daily-*` の重複）を `DELETE ... WHERE EXISTS` で先に潰してから UPDATE する 2 段構成に書き直し、`wrangler d1 execute life-editor-sync --remote --file=...` で本番 D1 に適用成功
- **Cloud Worker 再 deploy**: `cloud/src/routes/sync.ts` の `/sync/changes` delta query 全てに `datetime()` 正規化適用 + `wrangler deploy`（Version `04d24d88-3e16-4abd-9322-7d2377c22991`）。ISO 8601 と SQLite スペース区切りの string 比較不整合を受け側で吸収
- **Rust sync_engine datetime() 正規化**: `src-tauri/src/sync/sync_engine.rs::query_changed` と 3 つの親 join query（`calendar_tag_assignments` / `routine_tag_assignments` / `routine_group_tag_assignments`）の `WHERE updated_at > ?1` を `WHERE datetime(updated_at) > datetime(?1)` に、`ORDER BY` も `datetime(updated_at) ASC` に統一
- **Rust regression test 追加**: `src-tauri/src/sync/sync_engine.rs` に `#[cfg(test)] mod tests` 新設。`collect_local_changes_catches_space_format_rows_with_iso_since` は space と ISO 両形式の notes を INSERT して ISO `since` で両方 capture されることを保証、`collect_local_changes_excludes_older_rows` は `datetime()` wrap が always-true にならないことを保証。`run_migrations()` を介して本番 schema で検証。cargo test 11 → 13 pass
- **Known Issue 013 起票**: `.claude/docs/known-issues/013-timestamp-format-mismatch-delta-sync-freeze.md` — `updated_at` の timestamp 形式混在で delta sync が同日編集を凍結する。Status=Fixed（暫定対応、書き込み側 ISO 8601 統一は別セッション）、Category=Bug/Sync/Schema、Severity=Blocking。Root Cause（ASCII 順 space<T） / Impact（silent failure で last_synced_at だけ前進）/ Fix 手順 / Lessons Learned を詳述
- **Known Issue 014 起票**: `.claude/docs/known-issues/014-delta-sync-nonmonotonic-updated-at.md` — delta sync が updated_at の非単調性に対応できず高 version 行が pull から漏れる。Status=Monitoring、Category=Bug/Sync/Structural、Severity=Important。Root Cause（Mobile が古時刻で v=372 push → Cloud 固定 → Desktop since が追い越し永久 desync）/ Impact / Workaround（Full Re-sync / Disconnect+Reconnect）/ 本命 3 案（A: server_updated_at 列 B: cursor 変更 C: Full Re-sync auto 化）を整理
- **INDEX.md 更新**: Monitoring に 014 追加、Fixed に 013 追加。Category 別索引（Bug/Sync/Schema/Structural）と Status 集計（Monitoring 3 / Fixed 9 / 合計 12）を更新
- **DB 規約 vision 新設**: `.claude/docs/vision/db-conventions.md` 9 章（背景 / §1 timestamp canonical form / §2 updated_at と version の役割分担 / §3 同期プロトコル制約 / §4 UPSERT と衝突解決 / §5 マイグレーション / §6 multi-language write / §7 禁止事項 / §8 関連ドキュメント / §9 今後の作業）。Rust `helpers::now()` と TS `new Date().toISOString()` を canonical、SQL 内 `datetime('now')` / `CURRENT_TIMESTAMP` / `chrono::Utc::now().to_rfc3339()` を禁止、LWW は `excluded.version > ...` のみで判定、D1 の `SQLITE_LIMIT_COMPOUND_SELECT=5` 制限、migration 3 点同期（Desktop ↔ Cloud ↔ Mobile）を集約
- **CLAUDE.md 更新**: §0 関連ドキュメント表に `db-conventions.md` 追加、§4 Data Model 冒頭に「write / sync / migration の規約詳細は `docs/vision/db-conventions.md` を必ず参照」の必読誘導を明記
- **MEMORY.md バグの温床更新**: 2026-04-22 時点 → 2026-04-23 更新版に改題し、013 / 014 / Cloud D1 migration が Desktop migration をそのまま流用すると失敗する罠 / Cloud deploy と D1 migration のタイミング / D1 compound SELECT 5 本制限 / wrangler d1 execute の `--file=` 引数の罠 / iOS binary と Cloud schema の三者不整合を追加。既存 8 項目 + 新規 6 項目 = 合計 14 項目
- **auto-memory 更新**: `~/.claude/projects/-Users-newlife-dev-apps-life-editor/memory/project_sync_architecture_weaknesses.md` を 4 点 → 6 点に拡充。description も「timestamp 形式混在・非単調 updated_at」を含めて最新化。検索キーワードに `datetime format mismatch` / `space vs T updated_at` / `non-monotonic updated_at delta freeze` / `server_updated_at cursor` を追加
- **session-verifier 実行（Gate 0-6 全 PASS）**: Scope 6 変更 + 3 新規 / Types: cargo check / tsc 0 / Lint: clippy 新規 warning 0（既存 209 件は本件無関係）/ Tests: cargo test 13 pass / Coverage: 013 regression test 2 本追加 / Structural: db-conventions.md §1 暫定対応ルールと整合 / Bug Scan: 高リスクパターンなし
- **ユーザー観測の補足**: 「Desktop → iOS の反映には iOS 側 Disconnect/Reconnect が必要」という現行挙動は Known Issue 014 の構造的制約の顕在化。iOS binary 旧版 (datetime() fix 未搭載) + Mobile に Full Re-sync ボタン欠落（MEMORY 既存予定）の合わせ技。本命解消は 014 本命 3 案と Mobile Full Re-sync 実装待ち
- **残課題（別セッション、db-conventions.md §9 に優先度順で記載）**: (1) `datetime('now')` 使用箇所を `helpers::now()` / `new Date().toISOString()` 経由の ISO 8601 に全置換 + 既存 space 形式データのバックフィル（013 恒久対応）/ (2) Cloud D1 に `server_updated_at` 列追加 + Worker UPSERT 時に書き込み + delta query 切替（014 本命）/ (3) Mobile Settings に Full Re-sync ボタン追加（014 暫定緊急弁 / MEMORY 既存）/ (4) `/sync/changes` cursor-based pagination 実装（012 本命）/ (5) Desktop `migrations.rs` と `cloud/db/schema.sql` の drift 検出 CI

---
