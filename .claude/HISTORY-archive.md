# HISTORY-archive.md - 変更履歴アーカイブ

### 2026-04-27 - 時間帯選択 UI を TimeDropdown に統一（Routine / RoutineGroup / EventDetail / ReminderSettings / MobileScheduleItemForm）

#### 概要

ユーザー要望「Routine アイテムや RoutineGroup の時間帯を手動で打たずドロップダウンで選べるようにしてほしい。Tasks の時間帯調整で既に整っている UI/UX を利用し、共通コンポーネント/フックがなければ作成。それ以外にも時間調整 UI があるため全て置き換え」を Auto mode で実施。実装プランなしの UI 統一リファクタリング。**調査**: Explore agent (very thorough) で全時間 UI を洗い出し、`shared/TimeDropdown` (Calendar / DayFlow / ScheduleItemEditPopup / TaskSchedulePanel / MiniCalendarGrid で既に使用中) がリファレンス実装と判明。新規共通コンポーネントの作成は不要 — TimeDropdown と既存 `shared/TimeInput` の props (`hour, minute, onChange(h, m), minuteStep, size, className`) が完全一致するため、Routine 系 / EventDetail はコンポーネント名置換のみで完了。Native `<input type="time">` は (h, m) ベースに onChange を書き換えて移行。**5 ファイル / 11 箇所** を統一、不要となった `shared/TimeInput.tsx` (231 行) を削除。session-verifier 全 6 ゲート PASS、tsc -b 0 / vitest 42 files / 376/376 pass。

#### 変更点

- **`Tasks/Schedule/Routine/RoutineEditDialog.tsx`**: `TimeInput` import を `TimeDropdown` に変更。Routine 開始/終了の TimeInput x2 (minuteStep=1) を TimeDropdown に置換。`adjustEndTimeForStartChange` / `clampEndTimeAfterStart` の呼出ロジックは onChange 内で維持
- **`Tasks/Schedule/Routine/RoutineGroupEditDialog.tsx`**: `TimeInput` import を `TimeDropdown` に変更。Group 時間範囲 (start/end x2, minuteStep=5, size=sm) + メンバールーチン時刻 (start/end x2, minuteStep=5, size=sm) の計 4 箇所を TimeDropdown に置換。`handleSlide` / `handleSlideEnd` (group 範囲の offset スライド) と `routineTimeEdits` Map 更新ロジックは維持
- **`ScheduleList/EventDetailPanel.tsx`**: `TimeInput` import を `TimeDropdown` に変更。Event 開始/終了の TimeInput x2 (minuteStep=5, size=sm) を TimeDropdown に置換。`handleStartTimeChange` の `adjustEndTimeForStartChange` 呼出は不変
- **`Settings/ReminderSettings.tsx`**: native `<input type="time">` (Daily Review 時刻設定) を TimeDropdown (minuteStep=15) に置換。`handleTimeChange` のシグネチャを `(e: ChangeEvent) => string` から `(h: number, m: number) => formatTime(h, m)` に書き換え、`utils/timeGridUtils::formatTime` を import
- **`Mobile/MobileScheduleItemForm.tsx`**: native `<input type="time">` x2 (start / end, mobile bottom sheet 内) を TimeDropdown (minuteStep=5) に置換。`utils/timeGridUtils::formatTime` を import、onChange は `(h, m) => setStartTime(formatTime(h, m))` のインライン arrow。`className="w-full justify-center px-2 py-1.5"` でグリッドレイアウト (`grid-cols-[1.3fr_1fr_1fr]`) に追従。**bg 不一致の意図的回避**: 当初 `bg-notion-bg-secondary` を className 経由で override したが、本プロジェクトは `tailwind-merge` 未導入のため Tailwind JIT の CSS 出力順依存で override 結果が不安定 → デフォルトの `bg-notion-bg` のまま (date input と僅かに色違いだがドロップダウンパネル本体とは一致)
- **削除**: `frontend/src/components/shared/TimeInput.tsx` (231 行) — 上記 5 ファイルが移行完了して callers 0。barrel export / テストも無し (grep で `TimeInput` の残参照は変数名 `dateTimeInputs` のみ確認済)
- **Verification**: `npx tsc -b` exit 0 / `npm run test` 42 files / 376/376 pass / `npx eslint <変更5ファイル>` 1 error (= MobileScheduleItemForm:64 useEffect 内 setState、git stash で pre-existing と確認、本セッション無関与) / session-verifier 全 6 ゲート PASS

#### 残課題

- **手動 UI 検証**: (a) RoutineEditDialog 開始/終了の Clock アイコン付きドロップダウン表示・選択動作 / (b) RoutineGroupEditDialog の group 範囲スライド (start 変更で member 全員シフト) / (c) EventDetailPanel の event 時刻ドロップダウン (parent panel `useClickOutside` と portal dropdown の干渉なし確認) / (d) ReminderSettings の Daily Review 時刻が 15 分刻みドロップダウンで保存されること / (e) MobileScheduleItemForm の bottom sheet 内ドロップダウン操作 (z-index 9999 portal がモバイル bottom sheet z-50 を超えること、grid 幅 fit、タップで開閉)
- **Mobile UX 評価**: native picker から TimeDropdown への切替は要モバイル実機検証。タッチデバイスでスクロール選択が想定通り機能しない場合は条件分岐 (touch device 時のみ native picker 復活) を検討候補
- **アンステージ変更**: 別セッション由来の `Layout/{LeftSidebar,TitleBar}.tsx` / `Mobile/MobileNoteView.tsx` / `Mobile/materials/MobileNoteTree*.tsx` / `Ideas/NoteTreeNode.tsx` / `WikiTags/WikiTagList.tsx` / `shared/UnifiedColorPicker.tsx` / `shared/UndoRedo/UndoRedoButtons.tsx` / `extensions/WikiTagView.tsx` / `i18n/locales/{en,ja}.json` / `src-tauri/{Cargo.toml, lib.rs, claude_commands.rs, terminal/pty_manager.rs}` / `.claude/CLAUDE.md` が working tree に残存。本コミットは TimeDropdown 統一 5 ファイル + TimeInput.tsx 削除 + .claude/ のみに絞る

---

### 2026-04-26 - Connect/Board の React Flow #008 警告解消 + Node/Board パフォーマンス改善

#### 概要

ユーザー報告 1「Node や Board のキャンバスを動かすと `[React Flow]: Couldn't create edge for source handle id: "left-target" ...` (#008) が頻発」+ 報告 2「Node Tab の Connect モードがオンのとき接続が繋がらない」+ 報告 3「Node や Board の動作がもっさりしている」を Auto mode で 1 セッション完遂。実装計画書なしのアドホック修正群。**警告原因**: PaperCard/Text の Handle が方向別 type 分け (`left-target` = target 専用 / `right-source` = source 専用) で、`ConnectionMode.Loose` 下でユーザーが target 起点でドラッグした自己ループ edge (DB 確認: `top-target`→`left-target` の card 内自己ループ 1 件) が `normalizeEdgeHandles` の swap でも target→target 組み合わせを救えず、React Flow の source-side lookup が `.source` クラスのハンドルから `left-target` を見つけられない。**Connect モード接続不可原因**: NoteNode/DailyNode の Handle が `!w-0 !h-0 !min-w-0 !min-h-0` で当たり判定ゼロ、`nodesDraggable={!connectMode}` のため Connect モード時はドット全体ドラッグ不可でハンドル経由しか繋げず詰む。**もっさり原因**: (a) `usePaperBoard` の `deleteNode`/`deleteEdge`/`duplicateNode`/`toggleNodeHidden` が `[nodes, edges]` 依存で毎ノード/エッジ更新ごとに identity 変動 → 親 `handleEdgeDelete` 再生成 → 全エッジ data 新規 → memo edge 全再描画 / (b) `PaperCanvasView::rfNodes` が `noteMap`/`memoMap` 経由で全ノート購読、無関係ノート編集で全カード再構築 / (c) `TagGraphView::initialNodes` が `selectedTagId`/`relatedNodeIds` 依存で、ノードクリックの dim/highlight 切替だけで全ノード再構築 / (d) 両ビューの `setFlowNodes(rfNodes)` useEffect が drag stop 後の往復で全ノード identity 上書き → React Flow 全 diff・全 re-measure / (e) `noteTagDots`/`memoTagDots` で `tags.find()` を per-assignment 呼び O(A × T) / (f) `buildNormalEdges` で per-tag `assignments.filter()` で O(T × A)。session-verifier 全 6 ゲート PASS、新規テスト 17 件追加、tsc -b 0 / vitest 42 files 376/376 pass。

#### 変更点

- **警告 #008 修正 — 双方向 Handle**:
  - `frontend/src/components/Ideas/Connect/Paper/PaperCardNode.tsx` / `PaperTextNode.tsx`: 各 Position に **同じ id で `type="source"` と `type="target"` の Handle を重ねて配置** (例: `left-target` の元 target Handle に対し source-type の duplicate を追加、`bg-transparent border-0 pointer-events-none` で視覚と当たり判定を抑制)。React Flow 公式の bidirectional パターンに沿う形で、DB に `sourceHandle: "left-target"` が残っていても `.source` クエリで該当 handle が見つかり #008 警告が止まる。`PaperCanvasView::normalizeEdgeHandles` のコメントを更新し、役割を「警告抑止」から「ベジェの見た目を素直に source→target 方向に揃える整形」に再定義
- **Connect モード接続不可修正 — Handle に当たり判定 + scoped pointer-events**:
  - `frontend/src/components/Ideas/Connect/NoteNodeComponent.tsx` / `DailyNodeComponent.tsx`: ハンドルを `width: 16, height: 16, minWidth/Height: 16, transform: translate(-50%, -50%), borderRadius: 50%` でドット中心に重ね、視覚は `!opacity-0`/`background: transparent` で維持
  - `frontend/src/index.css`: `.react-flow__node-noteNode .react-flow__handle` / `.react-flow__node-dailyNode .react-flow__handle` をデフォルト `pointer-events: none`、`.tag-graph-connect-mode` 配下でのみ `pointer-events: auto` に上書き。通常モードのドットクリック・ドラッグ・ホバーをハンドルに奪われない
- **パフォーマンス改善**:
  - `frontend/src/hooks/usePaperBoard.ts`: `nodesRef`/`edgesRef`/`boardsRef` を `useLayoutEffect` で同期 (lint `react-hooks/refs` 違反解消も兼ねる)、`deleteNode`/`deleteEdge`/`duplicateNode`/`toggleNodeHidden` の deps を `[nodes, edges]` から `[push]` のみに縮減して identity 安定化
  - `frontend/src/components/Ideas/Connect/Paper/PaperCanvasView.tsx`: edge `data: { onDelete }` を `useMemo` で全エッジ共有化 (memo edge component の不要 invalidation 解消)。card data から `label`/`contentPreview`/`isDeleted` を排除し `refEntityId`/`refEntityType` のみ渡す形に簡素化、`noteMap`/`memoMap` 削除 → `rfNodes` useMemo deps から `notes`/`dailies` を排除
  - `frontend/src/components/Ideas/Connect/Paper/PaperCardNode.tsx`: `useNoteContext`/`useDailyContext` を card 内で直接購読、`label`/`contentPreview`/`isDeleted` を `useMemo` で算出。無関係なノート編集が全カード rebuild を引き起こさず、対象カードのみが context 経由で再描画
  - **新規 `frontend/src/components/Ideas/Connect/TagGraphSelectionContext.ts`** (selectedTagId + relatedNodeIds を保持する view-local context、CLAUDE.md §6.3 例外規定に該当する単一ファイル形式)
  - `frontend/src/components/Ideas/Connect/NoteNodeComponent.tsx` / `DailyNodeComponent.tsx`: data から `highlighted`/`dimmed` を除去、`useTagGraphSelection()` 経由で各ノード内に算出。クリック時の dim/highlight 切替で `initialNodes` 再構築を avoid
  - `frontend/src/components/Ideas/Connect/TagGraphView.tsx`: `initialNodes` useMemo deps から `selectedTagId`/`relatedNodeIds` を除外、`buildNormalNodes`/`buildSplitViewNodes` 全箇所の data から `highlighted: false`/`dimmed: false` を削除。`<TagGraphSelectionContext.Provider>` で ReactFlow を包む。**O(1) lookup**: `tagsById: Map<id, WikiTag>` 導入で `tags.find()` を排除 (noteTagDots/memoTagDots の O(A × T) → O(A))、`noteEntityIdsByTag: Map<tagId, entityId[]>` 導入で `buildNormalEdges` の per-tag `assignments.filter` を排除 (O(T × A) → O(T + A))
  - **新規 `frontend/src/components/Ideas/Connect/reactFlowMerge.ts`** (146 行): `mergeNodes` / `mergeEdges` 純粋ユーティリティ。id 同一かつ position/parent/hidden/zIndex/style.{w,h}/data shallow が等価なら既存 object identity を維持。`tagDots` のような content-equivalent な配列は `deepArrayDataKeys` 指定で item-wise 比較。両ビューの `setFlowNodes(rfNodes)` useEffect を merge 化し、drag stop 後の paperNodes 往復で全ノード identity 上書き → React Flow 全 diff を回避
  - 新規テスト `frontend/src/components/Ideas/Connect/reactFlowMerge.test.ts` 17 件: identity preservation / position・data・style 変更検出 / 削除・追加・並べ替え検出 / `deepArrayDataKeys` (tagDots 同値判定) / edge data ref 変更検出
- **Verification**: `cd frontend && npx tsc -b` 0 error / `npm run test` 42 files / 376/376 pass (前回 359 + 新規 17 = `reactFlowMerge.test.ts`) / session-verifier 全 6 ゲート PASS

#### 残課題

- **手動 UI 検証**: dev server 完全再起動 + ブラウザ完全リロード (Cmd+Shift+R) 必須 — React Flow の `node.internals.handleBounds` はノード寸法不変の場合再計測されないため、HMR で Handle を増やしただけだと古いキャッシュが残る。再起動後に (a) Board でノードを動かしても #008 警告が出ないこと、(b) Node Tab の Connect モードでドット同士をドラッグして繋がること、(c) Board でノートを編集しても他カードがチラつかないこと、(d) Node Tab でノードクリックの dim/highlight が瞬時に反映されること を確認
- **pre-existing lint 違反**: 本セッションでは触れず: `PaperTextNode.tsx:21` setText-in-effect / `PaperCanvasView.tsx:351` `isDescendant` 自己再帰 useCallback / `usePaperBoard.ts:77` 旧 useEffect の `activeBoardId` missing dep warning。いずれも別セッションで一括対応候補
- **アンステージ変更**: 別セッション由来の `Layout/SidebarLink*.tsx` / `Mobile/materials/MobileNoteTree*.tsx` / `Mobile/MobileNoteView.tsx` / `Ideas/NoteTreeNode.tsx` / `WikiTags/WikiTagList.tsx` / `shared/UnifiedColorPicker.tsx` / `extensions/WikiTagView.tsx` / `commands/claude_commands.rs` / `terminal/pty_manager.rs` 他 + Mobile 新規 9 ファイル / lucideIconRegistry 等が working tree に残存。本コミットは Connect/Board 関連 11 ファイル + .claude/ のみに絞る

---

### 2026-04-26 - CLAUDE.md / 各種設定の最新化 + コンパクト化

#### 概要

ユーザー要望「CLAUDE.md と各種設定を現在のコードを分析して最新化、不要・重複部分を削除してコンパクト化」を Auto mode で実施。実装プランなしのドキュメント整備。コードを直接 grep してスキーマ / Provider 順序 / MCP ツール数を実測 → CLAUDE.md の事実不整合（schema 版数の遅延、`RELATION_TABLES_WITH_UPDATED_AT` の誤った記述、markdown フォーマッタによる italic 混入）を全て修正。`settings.local.json` から旧プロジェクト由来の stale エントリ約 46% を除去。Known Issues INDEX に欠落していた 009/010 を追加。

#### 変更点

- **`.claude/CLAUDE.md` §3.1 (Architecture)**: SQLite path を bundle ID に依存しない `app_data_dir/life-editor.db` に汎化。実 bundle ID `com.lifeEditor.app.newlife`（`tauri.conf.json` 由来）を明示し、Known Issue 006（bundle ID 分裂）への参照を追加
- **`.claude/CLAUDE.md` §4.1 (SQLite スキーマ)**: schema を v67 → **v69** に更新。正本パスを単一 `migrations.rs` → モジュール構成 `migrations/`（`v61_plus.rs` + `full_schema.rs` + `mod.rs::LATEST_USER_VERSION`）に追従。V68（`timer_sessions.session_type` CHECK に `'FREE'` 追加）/ V69（Routine Tag 概念を全削除し `routine_group_assignments` 新設、`frequencyType="group"` 用）を追記。Cloud D1 0006（CTA `server_updated_at` 取りこぼし修正）/ 0007（V69 追従）を追記。markdown フォーマッタで italic 化されていたテーブル名（`time*memos`、`sound\_\_`、`wiki*tags` 等）を全て backtick で保護。`VERSIONED_TABLES`(11) と `RELATION_TABLES_WITH_UPDATED_AT`(3) の最新内訳を `sync_engine.rs` から実測して追記。`calendar_tag_assignments` は inline ハンドリングであり「`RELATION_TABLES_WITH_UPDATED_AT` に昇格」という旧記述は誤りだったため訂正
- **`.claude/CLAUDE.md` §4.2 (特化 vs 汎用 DB)**: 特化テーブル一覧に `routine_groups` / `sidebar_links` を追加
- **`.claude/CLAUDE.md` §7.3 (DB マイグレーション)**: 追加手順を `v61_plus.rs` 末尾 + `LATEST_USER_VERSION` bump に明示。カラム名変換の主体を旧 `rowToModel` から実装の `FromRow` trait + `row_to_json` に修正。診断コマンドを bundle ID 直書きから `find` 経由に変更
- **`.claude/CLAUDE.md` §8 (次フェーズ計画)**: `vision/mobile-data-parity.md` / `vision/realtime-sync.md` / `2026-04-26-windows-android-port.md` への参照を追加
- **`.claude/docs/known-issues/INDEX.md`**: Fixed セクションに 009（Mobile Provider バイパス、Structural、2026-04-20 Resolved）/ 010（Notes/Memos delta sync 脱落、Bug/Sync、2026-04-20 Resolved）を追加。Category 別インデックスと Status 集計を 8 → 10 件に更新
- **`.claude/settings.local.json` (98 → 53 行、約 46% 削減)**: 旧 `notion-timer` 絶対パス権限を全削除。廃止済 `feature_plans/` への mv コマンド・shell 制御フラグメント（`do if [ -f` / `then echo` / `else echo` / `fi` / `done` 単体）・無意味な echo 重複（`echo ''` / `echo '. "$HOME/.cargo/env"'`）を削除。残存権限を ABC 順に整理
- **HISTORY ローリングアーカイブ**: 5 件 → 6 件に達するため、最古エントリ「リファクタリング計画 Phase 2-2/2-3b/2-3c/2-3d/3-2/3-3/3-5 集中実施」を `HISTORY-archive.md` 先頭に移動（HISTORY.md は最新 5 件保持）

#### 残課題

- **MEMORY.md 整理**: `バグの温床 / 今後の注意点(2026-04-23 更新)` セクションは task-tracker 標準形式の 3 セクション構成（進行中 / 直近の完了 / 予定）から外れる。本セッションでは触らず、次回 task-tracker 起動時に判断
- **コードと未整合な vision ドキュメント**: 本セッションでは `docs/vision/*.md` に手を入れていない。`db-conventions.md` / `coding-principles.md` 等が現コードと乖離している可能性は別タスクで監査推奨
- **frontend skills の最新化**: `.claude/skills/` 配下（add-component / add-feature 等）の手順書はコード変更（DataService 19 モジュール分割、Provider 階層更新）に追従しているか未検証

---

### 2026-04-26 - LeftSidebar Links セクション UI 改善 + Collapsed ポップオーバー化

#### 概要

ユーザー要望「(1) 開いた状態でも Tips 上の白線を表示 / (2) リンクフィールドの header をもう少し大きくフィールド境界を視覚化 / (3) リンクアイコンを header 横と Collapsed Sidebar に追加し、Collapsed のリンクアイコンクリックでリンク一覧をダイアログ表示」+ 追加要望「(4) 一覧ダイアログを画面中央モーダル → リンクアイコン横の吹き出し（ポップオーバー）形式に変更、編集アイコンクリック時のダイアログは中央のまま、ただし縦長すぎるので 2 カラム化」を Auto mode で実装。実装計画書なしの UI/UX 改善 4 ファイル。session-verifier 全 6 ゲート PASS。

#### 変更点

- **`Layout/LeftSidebar.tsx`**: Links section header に `Link2` アイコン併置 + フォントサイズ 10px → 11px + `font-semibold` + 上 border `border-notion-border/60` → 不透明 `border-notion-border` + `pt-2 mt-2` → `pt-3 mt-2` で区切り強化。フッター div に `border-t border-notion-border` 追加で開いた状態でも Tips 上の境界線が表示されるよう CollapsedSidebar と統一
- **新規 `Layout/SidebarLinksListDialog.tsx`** (234 行): `anchorRect: DOMRect | null` prop を受け取り、`position:fixed` の `top/left` 計算で anchor の右側 8px に配置。矢印テイル (`bg-notion-bg` + `border-l border-b` + `rotate(45deg)`) を anchor 中央に追従、`useLayoutEffect` で popoverHeight 実測 → viewport clamp。外クリック / ESC で `onClose`、**編集モーダル open 中は mousedown/keydown listener 解除**で誤 close 防止。内部 Add/Edit/Delete + リンク open 動線 (open 後は `onClose` で閉じる)、Add/Edit は子の `SidebarLinkAddDialog` を Fragment 内で portal 開く（中央モーダルのまま維持）
- **`Layout/CollapsedSidebar.tsx`**: main items 下に `Link2` ボタン + 件数バッジ (`min-w-[14px] h-[14px]` notion-accent 円形 + 99+ 折返し) を追加。`useRef<HTMLButtonElement>` でリンクアイコンの `getBoundingClientRect()` を click 時に取得して `SidebarLinksListDialog` に渡す。ボタンと Tips の間に `border-t border-notion-border` 区切り
- **`Layout/SidebarLinkAddDialog.tsx`**: 幅 `w-96` (384px) → `w-[600px] max-w-[92vw]` に拡大。body を `space-y-3` → `grid grid-cols-2 gap-x-4 gap-y-3` に変更。左カラム=Type / Display name / Target (URL or App search) / 右カラム=Icon (Emoji or Lucide grid)。error は `col-span-2` で全幅エラー表示。縦長すぎるダイアログを横方向に展開
- **検証**: `tsc -b` 0 error / vitest 40 files 344/344 pass / `eslint <変更4ファイル>` 0 error / session-verifier 全 6 ゲート PASS

#### 残課題

- **手動 UI 検証**: (a) サイドバー開閉時に Tips 上の境界線が常時表示 / (b) Links ヘッダーの視認性向上 (Link2 アイコン + フォント強化) / (c) Collapsed のリンクアイコン → 吹き出しが anchor 右に出て矢印が中央 / (d) 外クリック・ESC で閉じる、ただし編集モーダル open 中はポップオーバーが残る / (e) ポップオーバー内編集アイコン → 中央 2 カラム Add/Edit ダイアログ / (f) 画面下端付近にアイコンがある場合の clamp
- **`useLayoutEffect` の deps**: `[links.length]` のみで popoverHeight 再計算するため、リンク件数を変えない編集 (name のみ変更) で高さが古いまま。実害は出にくい (高さ ≈ アイテム数 × 行高) が、念のため記録
- **Test カバレッジ**: 新規ダイアログのインタラクションテストは Provider 設定コスト過大のため別セッションで一括対応 (mockDataService 拡張 + `renderWithProviders`)

---

### 2026-04-26 - Calendar/DayFlow UX 改善 5 件 + Materials エラー改善

#### 概要

ユーザー報告の 5 件 (Materials の `No such file or directory (os error 2)` 原因 / Calendar 「ルーチン」→「ルーティン」i18n / Routine アイテム Edit 導線 + 管理画面遷移ボタン / Work セッションの DayFlow 表示 / 編集パネルが終日トグル/時間変更で消える UX 問題) を Auto mode で 1 セッション完遂。実装計画書なしのアドホック修正群。session-verifier 全 6 ゲート PASS、新規テスト 15 件追加 (SessionBlock.test.tsx)、既存 344 tests 全合格、cargo check / tsc -b clean。

#### 変更点

- **Task 1 — Materials os error 2 真因 + エラーメッセージ改善** (`src-tauri/src/commands/files_commands.rs`):
  - 真因: `app_settings_repository` 保存の `files_root_path` がディスク上に存在しない／移動・リネーム済み・権限不足の場合、`validate_path::root.canonicalize()` が ENOENT(2) で失敗し、`os error 2` がそのままフロントの error バナーに表示
  - 修正: `validate_path` で `e.kind() == NotFound` を判別し `"Configured root folder not found: {path}. Please reconfigure in Settings."` に変換、それ以外の IO エラーも `"Cannot access root folder: {e}"` で文脈を補完
- **Task 2 — Calendar 「ルーチン」→「ルーティン」i18n** (`frontend/src/i18n/locales/ja.json`):
  - `calendar.createRoutine` "ルーチン" → "ルーティン" / `calendar.newRoutinePlaceholder` "名前なしのルーチン" → "名前なしのルーティン" / `notifications.routineReminders` "ルーチンのリマインダー" → "ルーティンのリマインダー"
- **Task 3 — Routine アイテム編集導線**:
  - i18n: `common.edit: "編集" / "Edit"` + `common.openManagement: "管理画面を開く" / "Open Management"` を ja.json / en.json 両方に追加。これにより `ScheduleItemPreviewPopup` の `t("common.edit", "Edit")` ボタンが「編集」表示になる (ユーザー「Edit押した後何も起きない」の主因はテキストが英語のままだった可能性大、編集ダイアログ自体は元々開いていた)
  - `RoutineEditDialog.tsx` に `onOpenManagement?` prop 追加、ヘッダーに Settings アイコン + 「管理画面を開く」ボタン (`text-notion-text-secondary hover:text-notion-text hover:bg-notion-hover` 標準トークン)。クリックで `onOpenManagement()` → `onClose()` の順で発火
  - `CalendarView.tsx` の RoutineEditDialog 利用箇所に `onOpenManagement={onOpenRoutineManagement}` を渡す (既存 prop を再利用、Edit → 編集ダイアログ → 管理画面 のワンクリック導線)
- **Task 4 — Work セッションを DayFlow に表示**:
  - `frontend/src/components/Tasks/Schedule/DayFlow/SessionBlock.tsx` 新規 (74 行): `startedAt` / `duration` から `top` / `height` を計算 (`(hr*60+min)/60 * SLOT_HEIGHT(60)`)、`sessionType` 別 4 色 (WORK=rose-400/45 / BREAK=emerald-400/35 / LONG_BREAK=sky-400/35 / FREE=violet-400/35)、duration null の場合は `completedAt - startedAt` フォールバック、最小高さ 4px、ISO string 入力にも対応、`title` 属性で `label/タスク名/sessionType表示 • 開始時刻 • N分` を表示
  - `ScheduleTimeGrid.tsx` に `timerSessions?: TimerSession[]` prop 追加、main column 左端 4px 幅レーン (z-10) に SessionBlock を絶対配置 — 既存アイテム (left:4px 以降) と干渉しない、taskId に対応する title を tasks prop から lookup
  - `OneDaySchedule.tsx` に `useTimerContext().completedSessions / isRunning` 購読、useState で `timerSessions: TimerSession[]` 管理、`useEffect([dateKey, completedSessions, isRunning])` で `getDataService().fetchTimerSessions()` + 日付フィルタ (`String(s.startedAt).substring(0,10) === dateKey`)、`cancelled` flag でレース防止、`logServiceError("Timer", "fetchSessions", e)` でエラー記録
- **Task 5 — 編集パネル維持**:
  - 真因 (3 箇所の explicit close): (a) `ScheduleItemPreviewPopup.tsx::DateInput.onChange` 内の `onClose()` / (b) `CalendarView.tsx::onUpdateDate` の `setScheduleItemPreview(null)` / (c) `CalendarView.tsx::TaskPreview onUpdateAllDay` の `setPreviewPopup(null)` / (d) `ScheduleTimeGrid.tsx::TaskPreview onUpdateAllDay` の `setTaskPreview(null)` / (e) `ScheduleTimeGrid.tsx::SchedulePreview onUpdateAllDay` の `setSchedulePreview(null)`
  - 修正: 上記 5 箇所の close 呼び出しを削除。これで終日トグル / 時間変更 / 日付変更すべてでパネルは開きっぱなし。完了切替 / 削除 / ロール変換は意図的に閉じる仕様を維持
- **新規テスト** (`frontend/src/components/Tasks/Schedule/DayFlow/SessionBlock.test.tsx`, 15 件):
  - null startedAt / duration+completedAt 両方欠落時の null 返却 / top 位置計算 / duration 由来 height / completedAt フォールバック / 最小高さ 4px clamp / 4 sessionType 別色クラス / label > taskTitle > sessionType 名のフォールバック順 / ISO string startedAt parse / tooltip に start time / duration min 含有
- **Verification**: `npx tsc -b --force` exit 0 / `npm run test` 40 files / 344 tests 全合格 + 新規 15 = 359 / `cargo check` exit 0 / lint: 私の変更箇所はクリーン (CalendarView の既存 `react-hooks/preserve-manual-memoization` 3 errors + `exhaustive-deps` 1 warning は line 360/375/390/481 の useCallback で本セッション無関与、別タスク化)

#### 残課題

- **手動 UI 検証**: (a) Materials の root path 削除→「Configured root folder not found」表示確認 / (b) Calendar daycell + ボタン → 「ルーティン」表示 / (c) Calendar daycell の routine item → 「編集」ボタン → RoutineEditDialog → 「管理画面を開く」ボタン → RoutineManagementOverlay 遷移 / (d) DayFlow に Pomodoro セッションの色付き左端ストライプ表示 / (e) Calendar/DayFlow の編集パネルで終日トグル / 時間変更 / 日付変更してもパネルが消えないこと
- **TimeDropdown ポータル click-outside 追加対策の保留**: Task 5 の修正後もまだパネルが消える場合は、TimeDropdown の `e.stopPropagation()` listener が `BasePreviewPopup::useClickOutside` を捉えきれていない可能性。手動検証で再現したら `disableClickOutside` の動的制御 or 共通 lookup 経路の見直しを検討
- **OneDaySchedule の RoutineEditDialog (line 919) には onOpenManagement 未配線**: DayFlow パスの routine item Edit から管理画面遷移は別タスク (本セッションは Calendar 経路のみ対応)
- **SessionBlock のオプション拡張**: 現状 4px 幅で hover ツールチップのみ。ユーザーから "もっと目立たせたい" or "クリック動作が欲しい" 等の要望が出れば次セッションで拡張
- **アンステージ変更**: 別セッション由来の `Layout/CollapsedSidebar.tsx` (lint 3 errors + 1 warning) / `LeftSidebar.tsx` / `SidebarLinkAddDialog.tsx` / `Mobile/MobileNoteView.tsx` / `Mobile/materials/MobileNoteTree*.tsx` / `Ideas/NoteTreeNode.tsx` / `WikiTags/WikiTagList.tsx` / `shared/UnifiedColorPicker.tsx` / `extensions/WikiTagView.tsx` / `claude_commands.rs` / `terminal/pty_manager.rs` / 各 db/\*\_repository.rs (前セッション Phase 3-1 の旧版残骸) が working tree に残存。本コミットは Task 1-5 関連 9 ファイル + .claude/ のみに絞る

---

### 2026-04-26 - リファクタリング検証 (Phase 2-4 / 3-1 / 3-4) 自動検証完遂

#### 概要

ユーザー要望「`.claude/2026-04-26-refactoring-verification-plan.md` の内容を読み込んでやるべきことをさらに分析した上で実装」を受け、verification plan の自動検証部分 (S-1 / S-7 / S-8 / S-9) を Auto mode で完遂。コード変更は前セッションで commit `ab84b85` に着地済 (FromRow trait 26 ファイル + calendarGrid.ts 共通化 4 ファイル) のため、本セッションは検証ゲート通過の確認 + 境界ケース自動化 + 性能 spot-check に専念。**結論**: Phase 3-1 起因の新規 clippy 警告 0、`prepare_cached` 移行不要 (R-1 リスク不発)、境界ケース 12 件追加で完全自動化。残課題は手動 UI 検証 (S-2〜S-6) のみ。

#### 変更点

- **S-1 Rust 単体検証**:
  - `cargo build --lib` 0 warnings / `cargo test --lib` 25/25 pass (1 ignored = `bench_fetch_tree`)
  - `grep -rnE "fn row_to_" src-tauri/src/db/` → `row_to_json` のみ ✓ (Phase 3-1 で全 free fn 削除済み確認)
  - `grep -rnE "row_to_[a-z_]+\(row" src-tauri/src/` → `helpers.rs::row_to_json` (3 箇所) + `sync_engine.rs::row_to_json` (1 箇所) のみ ✓
  - `cargo clippy --lib -- -D warnings`: 83 件警告 = **全件 pre-existing** (内訳: migrations/v2_v30.rs 29 + v31_v60.rs 30 + v61_plus.rs 9 = 68 / reminder.rs 6 / sync_engine.rs 2 (`field_reassign_with_default`) / claude_commands.rs 1 (`manual_flatten`) / repository 系 3 件はいずれも `too_many_arguments` on 11-arg `create()`)。Phase 3-1 の FromRow 移行起因は 0、別セッションで cleanup 必要
- **S-7 境界ケース完全自動化** (`frontend/src/utils/calendarGrid.test.ts` 8 → 20 tests):
  - 追加 12 件: うるう年 2024/2 (Sun/Mon 両モード) / 月初 Sat (2026/8) / 月初 Mon (2026/6) / `addDays` 年跨ぎ前進・後退 / `getMondayOf` 日曜→6 日前・同曜・水曜・時刻正規化・非破壊 / `getWeekDates` 7 日 array
  - `npx vitest run src/utils/calendarGrid.test.ts` 20/20 pass。verification plan §S-7 の境界ケース全項目自動化済 (旧 plan は手動補足を想定していたが本セッションで全て test 化)
- **S-8 性能 spot-check** (`cargo test --release --lib db::task_repository::fetch_tree_benchmark -- --ignored --nocapture`):
  - 結果 (10 runs avg): n=500: 3.14ms / n=1000: 6.55ms / n=3000: 18.37ms
  - 基準 100ms に対し最大でも 18.5% — `query_all` の `prepare()` 毎回呼び出しによる劣化は実質無視可能
  - **`prepare_cached` 移行不要**を確定 (R-1 リスク不発)
- **S-9 検証 plan ファイル更新** (`.claude/2026-04-26-refactoring-verification-plan.md`):
  - Status を `PENDING` → `AUTOMATED COMPLETE / MANUAL PENDING` に更新
  - S-1 / S-7 / S-8 / S-9 のチェックボックスを実績で `[x]` または `[~]` (S-1 clippy のみ部分) に
  - Done 定義セクションも更新
  - Related リンクを `.claude/archive/2026-04-25-refactoring-plan.md` に修正 (前セッションで archive 済み)
- **frontend 再検証**: `npx tsc -b` 0 / `npm run test` 40 files / 344/344 pass (前回 332 + 私が追加した 12) / `npm run build` Vite production clean

#### 残課題

- **手動 UI 検証** (verification plan §S-2〜S-6): Desktop/iOS 実機での 11 ドメイン IPC fetch / Cloud Sync 5000 行超 round-trip / Calendar Mobile (Monday 始まり / スワイプ / chip / Today) / Calendar Desktop (Sunday 始まり / 6 行固定 / Weekly Grid) / Schedule View (週 dots / 月跨ぎラベル / 4 タブ)
- **完了後の docs 整理**: `docs/known-issues/INDEX.md` で formatter / SQL whitelist / row_to_model 重複 を削除候補マーク / `docs/code-inventory.md` の Active/Duplicate セクション更新 (UI 検証完了後に実施推奨)
- **clippy 既存 83 警告**: pre-existing で本検証外、別セッションで cleanup 候補 (migrations / reminder / repository `create()` シグネチャ)

---

### 2026-04-26 - リファクタリング計画 Phase 2-4 / 3-1 / 3-4 完遂 + 検証用実装計画書作成

#### 概要

ユーザー要望「`.claude/2026-04-25-refactoring-plan.md` を読み込んで未実装のリファクタリングを実装して。またその後にリファクタリング検証のための実装計画書も作成して」を受け、前セッションで deferred とされた 3 Phase を Auto mode で 1 セッション内に完遂。**Phase 3-1** (Rust 26 ファイル) は FromRow trait + query_all/query_one helpers を導入し 33+ の `fn row_to_X` を `impl FromRow for X` に移行 — 4 並列 sub-agent で機械的書き換えを高速実行。**Phase 2-4 / 3-4** は Mobile/Desktop の Context vs Service層差で完全 UI 統合は regression リスク高と判定し、純粋ロジックのみ抽出する保守的アプローチに変更（Phase 2-3b/d と同方針）— `utils/calendarGrid.ts` 新設で `buildCalendarGrid` / `addDays` / `getMondayOf` / `getWeekDates` を共通化、4 ファイル (Mobile 3 + useCalendar) の duplicate 関数群を削除。検証用実装計画書 `.claude/2026-04-26-refactoring-verification-plan.md` を 9 ステップ + 6 リスク + 段階的 rollback 手順で作成。実装プラン `2026-04-25-refactoring-plan.md` は全 Phase 完了に伴い `.claude/archive/` へ移動。session-verifier 全 6 ゲート PASS。

#### 変更点

- **Phase 3-1 — FromRow trait + 26 repository 移行 (Rust)**:
  - `src-tauri/src/db/row_converter.rs`: `FromRow` trait (`fn from_row(&Row) -> Result<Self>`) + `query_all<T: FromRow, P: Params>` + `query_one<T: FromRow, P: Params>` ヘルパを追加。`row_to_json` (column-agnostic JSON converter) は既存維持
  - 24 repository ファイル + sidebar_link を移行: `calendar_repository.rs` / `calendar_tag_repository.rs` / `daily_repository.rs` / `database_repository.rs` (4 model) / `note_connection_repository.rs` / `note_link_repository.rs` / `note_repository.rs` / `paper_board_repository.rs` (3 model) / `playlist_repository.rs` (2 model) / `pomodoro_preset_repository.rs` / `routine_group_assignment_repository.rs` / `routine_group_repository.rs` / `routine_repository.rs` / `schedule_item_repository.rs` / `sidebar_link_repository.rs` / `sound_repository.rs` (4 model) / `task_repository.rs` / `template_repository.rs` / `time_memo_repository.rs` / `timer_repository.rs` / `wiki_tag_connection_repository.rs` / `wiki_tag_group_repository.rs` (2 model) / `wiki_tag_repository.rs` (2 model)
  - 各ファイル: `fn row_to_X(&Row) -> Result<X> { ... body ... }` → `impl FromRow for X { fn from_row(...) -> Result<Self> { ... 既存 body 完全保持 ... } }` に置換、callers の `prepare → query_map → collect` を `query_all(conn, sql, params)` に / `prepare → query_row` を `query_one(conn, sql, params)` に / Option 返却の match 付きパターンを `match query_one::<T, _>(conn, sql, params) { ... }` に変換
  - エッジケース: `note_link_repository::fetch_backlinks` は query_map 内で `BacklinkHit` 組立カスタムロジックがあるため closure 内で `NoteLink::from_row(row)?` 置換のみ (closure pattern 4) / transaction 内 (`tx.query_map`) は SQL 経由のため対象外で保持 / SQL 文字列・パラメータ・ロジックは全件無変更
  - SQL injection 観点不変: `prepare_cached` 化は性能劣化検証時の対応として verification plan §R-1 / S-8 に記載
- **Phase 2-4 — Calendar 共通ロジック抽出**:
  - `frontend/src/utils/calendarGrid.ts` 新設 (59 行): `buildCalendarGrid({year, month, weekStartsOn: 0|1, fixedRows?})` で月グリッド計算を統一 (Sunday 始まり / Monday 始まり両対応、`fixedRows: 6` で 42 セル固定 or 自動 7 倍数 padding) / `addDays(date, days)` / 補助 export `CalendarGridDay` / `CalendarGridOptions`
  - `frontend/src/utils/calendarGrid.test.ts` 新設 (8 tests): Sunday/Monday 始まり両モード / fixedRows 有無 / 月境界 (2026 年 2 月 = 月初 Sun, 28 日) / うるう年 / addDays 月跨ぎ
  - `frontend/src/hooks/useCalendar.ts`: 30 行の `calendarDays` useMemo (Sunday 始まり、6 行 padding) を `buildCalendarGrid({year, month, weekStartsOn: 0, fixedRows: 6})` 1 行呼び出しに置換
  - `frontend/src/components/Mobile/MobileCalendarView.tsx`: 12 行の inline `calendarDays` (Monday 始まり、`{date, inMonth}`) を `buildCalendarGrid({year, month, weekStartsOn: 1})` に置換、destructure rename `{date, isCurrentMonth: inMonth}` で内部 prop 互換維持。等価性検証: dow=0(Sun) → 旧 startDow=-1→6 / 新 startPad=(0+6)%7=6 ✅ / dow=1 / dow=6 全て一致
- **Phase 3-4 — Schedule 共通 hook 抽出**:
  - `calendarGrid.ts` に `getMondayOf(date)` (Mon = 月曜、Sun → 6 日前へ) / `getWeekDates(monday)` (7 日 array) を追加
  - `MobileCalendarStrip.tsx`: local `getMonday` / `formatDateStr` / `addDays` / `getWeekDates` 4 関数 (約 24 行) を削除、共有版 import に置換
  - `MobileScheduleView.tsx`: `loadWeekItems` の inline week-range 計算 (15 行) を `const monday = getMondayOf(...); const sunday = addDays(monday, 6)` 2 行に圧縮、local `todayStr()` 削除して `getTodayKey` lazy init pattern に
  - `MobileCalendarView.tsx`: local `todayStr()` 削除、`getTodayKey` 直接利用
  - `formatDateStr` (3 ファイルの duplicate) → `formatDateKey` (utils/dateKey.ts の正規版) に統一
- **検証用実装計画書 `.claude/2026-04-26-refactoring-verification-plan.md` 作成 (9 Steps + 6 Risks)**:
  - **S-1〜S-3**: Rust 単体 (cargo build/test/clippy) → IPC 統合 (11 ドメインの fetch 経路) → Cloud Sync round-trip (5000 行超 pagination 確認)
  - **S-4〜S-6**: Calendar Mobile (Monday 始まり / スワイプ / chip) / Calendar Desktop (Sunday 始まり / 6 行固定 / Weekly Grid) / Schedule View (週 dots / 月跨ぎラベル / 4 タブ)
  - **S-7**: buildCalendarGrid 境界ケース (月初 Sun/Mon/Sat / うるう年 / getMondayOf(日曜) → 6 日前)
  - **S-8**: 性能 spot-check (`query_all` の prepare 毎回呼び出し → 1000 ノード fetch_tree benchmark / Calendar 月遷移体感)
  - **S-9**: ドキュメント更新 + plan archive
  - **R-1〜R-6**: 性能劣化リスク (prepare_cached 化で対応) / 週初日混乱 / hidden caller / Cloud Sync 副次破壊 / 例外パターン許容 / 境界ケース見落とし
  - 各 Phase 独立 rollback 手順 + DB migration 不要のため schema rollback 不要
- **計画書アーカイブ**:
  - `.claude/2026-04-25-refactoring-plan.md` の Status を `IN_PROGRESS (...)` から `COMPLETED (Phase 0-3 全完了 2026-04-26)` に更新、Phase 2-4 / 3-1 / 3-4 の `[ ]` を `[x]` に + 完了内容を追記
  - `.claude/archive/` に移動 (`mv ./2026-04-25-refactoring-plan.md ./archive/`)
- **Verification**: `cd frontend && npx tsc -b` 0 error / `npm run test` 40 files / 332/332 tests pass (前回 324 + 新規 8 = `calendarGrid.test.ts`) / `cd frontend && npm run build` Vite production 7.9s clean / `cd src-tauri && cargo build --lib` 0 warnings / `cargo test --lib` 25/25 pass (1 ignored bench) / `cargo clippy --lib` 私の変更ファイルで新規警告 0 (3 件の `too_many_arguments` は `pub fn create()` の既存シグネチャに対する pre-existing 警告、本セッション関与なし) / Frontend ESLint 0 / session-verifier 全 6 ゲート PASS

#### 残課題

- **手動 UI 検証**: 検証用実装計画書 `2026-04-26-refactoring-verification-plan.md` の S-2〜S-6 を実機で実施 (a) IPC 経由 11 ドメイン fetch / (b) Cloud Sync round-trip 5000 行超 / (c) Calendar Mobile (Monday 始まり / スワイプ / chip) / (d) Calendar Desktop (Sunday 始まり / 6 行) / (e) Schedule View (週 dots / 月跨ぎラベル / 4 タブ)
- **性能 spot-check**: `query_all` / `query_one` で毎回 `conn.prepare()` を呼ぶため、大量データで劣化の可能性。劣化確認時は `prepare_cached` 化で API 互換のまま対応 (検証 plan §R-1 / S-8)
- **アンステージ変更**: 別セッション由来の `Layout/SidebarLink*.tsx` / `Mobile/materials/MobileNoteTree*.tsx` / `Mobile/MobileNoteView.tsx` / `Ideas/NoteTreeNode.tsx` / `WikiTags/WikiTagList.tsx` / `shared/UnifiedColorPicker.tsx` / `extensions/WikiTagView.tsx` / `commands/claude_commands.rs` / `terminal/pty_manager.rs` 他 ~13 ファイルが working tree に残存。本コミットは Phase 2-4 / 3-1 / 3-4 関連 33 ファイル (Rust 26 + Frontend 7) + .claude/ のみに絞る

---

### 2026-04-26 - リファクタリング計画 Phase 2-2/2-3b/2-3c/2-3d/3-2/3-3/3-5 集中実施

#### 概要

ユーザー要望「.claude/2026-04-25-refactoring-plan.md の未完了タスクを完了させて」を受け、Auto mode で 1 セッション内に Phase 2-2 (TauriDataService 分割) / 2-3b (ScheduleTimeGrid pure logic 抽出) / 2-3c (OneDaySchedule hook 抽出) / 2-3d (TagGraphView storage 抽出) / 3-3 (Schedule → ScheduleList rename) / 3-2 (cursor pagination 本実装、Issue #012) / 3-5 (UNIQUE 制約 audit) を完了。手動 UI 検証必須の Phase 2-4 (Calendar 統合) / Phase 3-4 (Schedule View 統合)、および 27 ファイルにわたる大規模 trait 化の Phase 3-1 (Rust row_to_model) は本セッションでは見送り。session-verifier 全 6 ゲート PASS、324/324 vitest tests pass (新規 36 件追加)、cargo build / test clean。実装計画書は IN_PROGRESS のままで archive せず継続。

#### 変更点

- **Phase 2-2 — TauriDataService 1502 → 52 行 + 19 ドメインモジュール** (`0f49dc5`):
  - `frontend/src/services/data/{tasks,timer,sound,daily,notes,calendars,routines,scheduleItems,playlists,wikiTags,timeMemos,paper,databases,files,sidebar,system,templates,sync,misc}.ts` を 19 モジュールに分割。各モジュールは const オブジェクトで `tauriInvoke` ラッパーを export
  - `TauriDataService.ts` は composition root として spread + `Object.assign(this, composed)` + class/interface declaration merging で `DataService` 型互換維持。後方互換: `dataServiceFactory.ts` の `new TauriDataService()` 50+ consumer は無改変
  - session-verifier の Gate 2 で `@typescript-eslint/no-unsafe-declaration-merging` 検出 → class 自体を撤去し `tauriDataService` const singleton に置換 (`8149fd6`)。`dataServiceFactory.ts` は const を直接参照、`services/index.ts` は const を re-export
- **Phase 2-3b — ScheduleTimeGrid 1221 → 926 行** (`b3e7a21`):
  - 純粋ロジック (`layoutAllItems` / `rangesOverlap` / `computeGroupFrames` / `detectRoutineTaskSplit` / `adjustItemsForRoutineSplit`、型 `UnifiedItem` / `ComputedGroupFrame`、定数 `HOURS` / `GUTTER_WIDTH` / `MIN_ITEM_HEIGHT` / `GROUP_HEADER_HEIGHT`) を `scheduleTimeGridLayout.ts` (326 行) に抽出
  - 当初計画の JSX サブディレクトリ分割 (GridLayer/EventLayer/DragHandlers/Hooks) は手動 UI 検証必須のため見送り、純粋関数のみ抽出する保守的アプローチ
- **Phase 2-3c — OneDaySchedule 1276 → 1172 行 + hook 2 件抽出** (`70b7b14`):
  - `useDayFlowFilters.ts` (97 行): フィルタ state + `filteredScheduleItems` / `filteredDayTasks` / `allDayTasks2` / `allDayScheduleItems` / `timedScheduleItems` / `hasAllDayItems` の memoized 派生
  - `useDayFlowDialogs.ts` (223 行): 8 つの popover/preview/menu state + 3 つのハンドラ (`handleRequestRoutineDelete` / `handleDismissOnly` / `handleArchiveRoutine`)。依存 mutation は引数で注入
  - `dayFlowFilters.ts` (16 行): `DAY_FLOW_FILTER_TABS` / `DayFlowFilterTab` 定数を分離。`OneDaySchedule.tsx` から re-export し `ScheduleSection.tsx` の既存 import path 維持
  - session-verifier で `setRoutinePicker` / `setNotePicker` の 4 件 missing-deps 警告検出 → useCallback の deps 配列に setter を追加 (state setter は安定だが、destructured オブジェクト経由のため ESLint が安定性を判定できず) (`8149fd6`)
- **Phase 2-3d — TagGraphView 1443 → 1414 行** (`865cc77`):
  - localStorage helpers (`loadPositions` / `savePositions` / `loadViewport` / `saveViewport` / `isSpecialFilterId` / `VIRTUAL_LINK_EDGES_HIDDEN_ID` 定数) を `tagGraphStorage.ts` (45 行) に抽出
  - React Flow 内部と密結合の JSX サブディレクトリ分割 (ForceLayout/Renderer/Interactions/Hooks) は手動 UI 検証必須のため見送り
- **Phase 3-3 — components/Schedule → ScheduleList rename** (`550e55f`):
  - `git mv frontend/src/components/Schedule frontend/src/components/ScheduleList` で 13 ファイル一括 rename
  - 外部 import 4 箇所更新: `App.tsx` (×2) / `useTaskDetailHandlers.ts` / `useSectionCommands.ts` / `Work/FreeSessionSaveDialog.tsx`
  - `Tasks/TaskDetail/*` の `../Schedule/shared/` import は `Tasks/Schedule/` を参照する別ディレクトリのため変更不要
  - Plan の "alias re-export 1 週間維持" は省略 — 端末 / claude history 等の外部参照は確認した限り無し
- **Phase 3-2 — cursor pagination 本実装 (Issue #012)** (`62d144f`):
  - Server (`cloud/src/routes/sync/versioned.ts`): `pullVersionedDelta` が batch 内の最大 `server_updated_at` を `nextSince` として返却 (戻り値型に `nextSince: string` を追加)。`/sync/changes` のレスポンスに同梱
  - Client (`src-tauri/src/commands/sync_commands.rs::sync_trigger`): 単発 fetch を `loop { fetch_changes(cursor); apply; if !has_more break; cursor = next_since; }` ループ化。`sync_last_synced_at` は全 page 完了後にのみ永続化 (中断時の再開保証)
  - `SyncPayload` (`src-tauri/src/sync/types.rs`) に `next_since: String` 追加 (旧サーバ互換: `#[serde(default)]` で空文字 fallback、空時は break して安全に終了)
  - 多重 break ガード: `has_more=false` / `next_since` 空 / cursor 進行なし のいずれかで終了 (無限ループ防止)
  - LIMIT=5000 (`SYNC_PAGE_SIZE`) は Phase 1-1 で既に `cloud/src/config/syncTables.ts` に切り出し済
- **Phase 3-5 — UNIQUE 制約 audit (no migration needed)** (`7645d2d`):
  - `src-tauri/src/db/migrations/full_schema.rs` 全 relation テーブルを audit。`sound_tag_assignments` / `routine_tag_assignments` / `wiki_tag_assignments` / `wiki_tag_group_members` / `routine_group_tag_assignments` / `calendar_tag_assignments` は全て `PRIMARY KEY` 複合キーで重複防止済、`wiki_tag_connections (source_tag_id, target_tag_id)` / `note_connections (source_note_id, target_note_id)` / `time_memos (date, hour)` / `database_cells (row_id, property_id)` / `note_aliases.alias` / `dailies.date` / 各 `*_definitions.name` は UNIQUE 既存
  - 唯一未制約な箇所は `note_links` (source/target/heading/block_id/link_type) だが、「同一ノート間に異なる heading を指す複数リンク」が正当ユースケースのため UNIQUE 化は要件 vague で見送り (V63 の schedule_items のように具体的問題発見時に別途対処)
  - 結論: Plan の「関連テーブルが UNIQUE 不足」前提が古い情報 (Phase 1 / Phase 2-1 の migration v60〜v67 で既に網羅されていた)。**migration 追加不要**
- **session-verifier 検出修正 + 新規テスト** (`8149fd6`):
  - TauriDataService class → const 化 (declaration merging 解消)
  - OneDaySchedule の useCallback deps に `setRoutinePicker` / `setNotePicker` 追加 (4 箇所)
  - 新規テスト 36 件: `scheduleTimeGridLayout.test.ts` (19 件: rangesOverlap / layoutAllItems / computeGroupFrames / detectRoutineTaskSplit / adjustItemsForRoutineSplit) / `tagGraphStorage.test.ts` (9 件: localStorage round-trips + isSpecialFilterId) / `useDayFlowFilters.test.ts` (8 件: フィルタ state + memoized 派生 via @testing-library/react)
- **計画書 (`.claude/2026-04-25-refactoring-plan.md`) 更新**: Status 行を `IN_PROGRESS (Phase 0 ✅ / Phase 1 ✅ / Phase 2-1 ✅ / Phase 2-2 ✅ / Phase 2-3a-d ✅ / Phase 3-2 ✅ / Phase 3-3 ✅ / Phase 3-5 ✅ AUDIT / Phase 2-4, 3-1, 3-4 deferred)` に更新。各 Phase の完了内容を Files / Verification / Notes として追記。**実装プランは Phase 2-4 / 3-1 / 3-4 が pending のため archive せず継続**
- **Verification**: `cd frontend && npx tsc -b` 0 error / `cd frontend && npm run test` 39 files / 324 passed (前回 288 + 新規 36) / `cd cloud && npx tsc --noEmit` clean / `cd src-tauri && cargo build --lib` clean / `cargo test --lib sync` 2/2 passed / 私の変更行で新規 lint 0 (残 114 lint problems は全て本セッション未触の既存問題、b860d04 baseline 同等) / session-verifier 全 6 ゲート PASS

#### 残課題

- **Phase 2-4 (Calendar Mobile/Desktop 統合)**: `CalendarView.tsx` (1168 行、month/week 両モード、多数の Context 依存) と `MobileCalendarView.tsx` (823 行、独自 UI) の差分大、Plan 自身が iOS 実機テスト必須と明記。手動 UI 検証なしでは regression 不可避のため別セッションで実施
- **Phase 3-1 (Rust row_to_model RowConverter trait)**: 27 ファイルにわたる個別 row*to*\* fn を trait impl に移行する大規模 refactoring (推定 -1500 行 = Plan 自身も "6-10 セッション" 想定の中核作業)。各 repo に微妙な差異 (joins / JSON serialize / snake↔camel) があり、機械的置換不可
- **Phase 3-4 (Schedule View Mobile/Desktop 統合)**: 2-4 と同じ UI 検証問題のため別セッションで実施
- **手動 UI 検証**: (a) Schedule (DayFlow / Calendar / Routine) の操作回帰なし / (b) Cmd+K / Sidebar Links 等の関連経路 / (c) Cloud Sync の cursor pagination 動作 (Worker deploy 後、5000 行超のテーブルがあれば実走確認)
- **Worker deploy 必須**: Phase 3-2 のサーバー側変更 (cloud/src/routes/sync/{index,versioned}.ts) は本番反映が必要。`cd cloud && npm run deploy`
- **アンステージ変更**: 別セッション由来の `Layout/SidebarLink*.tsx` / `Mobile/materials/MobileNoteTree*.tsx` / `Ideas/NoteTreeNode.tsx` / `WikiTags/WikiTagList.tsx` 他 ~13 ファイルが working tree に残存。本一連の commit は refactoring 関連 + `.claude/` のみに絞っている

### 2026-04-26 - WikiTag カラーピッカー文字色/プリセット即閉鎖バグ + ネスト枠 UI 修正

#### 概要

ユーザー報告: WikiTag (TipTap inline / WikiTagList chip) の編集パネルでカラーピッカーのプリセット色 / 文字色タブをクリックすると色が変わらず即パネルが閉じる + ピッカーの幅が固定 (190px) で WikiTag 編集パネル (208px) と合わず二重枠の不格好 UI。**真因 (バグ)**: `WikiTagList.tsx` / `WikiTagView.tsx` の編集パネル上部入力 `<input autoFocus>` が `onBlur` で `handleEditSave` → `setEditing(false)` を呼ぶ。macOS WebKit では `<button>` クリックで focus が button に移らず `e.relatedTarget = null`、`editRef.current.contains(null)` が false → 即 save → panel 閉じる → click event は to なし。実装計画書を伴わない小規模バグ修正。session-verifier 全 6 ゲート PASS。

#### 変更点

- **`UnifiedColorPicker.tsx` バグ修正 + UI prop 追加** — `frontend/src/components/shared/UnifiedColorPicker.tsx`:
  - 全 interactive ボタン (Background/Text タブ 2 個・12 プリセット色・"Default" リセット) に `onMouseDown={(e) => e.preventDefault()}` を追加。`<input autoFocus>` を持つ親パネル (WikiTagList / WikiTagView) でクリック時に input が blur せず `handleEditSave` 経由の panel 閉鎖が発生しない。macOS WebKit が `<button>` クリックで focus を移さない仕様 (`e.relatedTarget = null`) に対する標準対処パターン
  - `embedded?: boolean` prop 新設。`inline + embedded=true` 時は picker 自身の `bg-notion-bg border border-notion-border rounded-md shadow-sm w-[190px]` 固定スタイルを捨て `w-full` で親コンテナいっぱいに伸長。親が既に bordered container を提供している場合の二重枠を解消
  - preset grid に `justify-items-center` を追加。embedded で grid 幅が拡大した際もボタンが各セル内で中央寄せされる
- **WikiTag 編集パネル 2 箇所で `embedded` 適用**:
  - `frontend/src/components/WikiTags/WikiTagList.tsx`: chip クリック時の編集ポップアップ内 `<UnifiedColorPicker inline embedded />` で外枠 `w-52 + p-2` の中にピッカーがフィット
  - `frontend/src/extensions/WikiTagView.tsx`: TipTap inline WikiTag クリック時の `wiki-tag-edit-popup` (CSS で 13rem) 内 `<UnifiedColorPicker inline embedded />` 同様
- **新規テスト** — `frontend/src/components/shared/UnifiedColorPicker.test.tsx` (4 件):
  - "calls onChange when a preset color is clicked" — `userEvent.click(getByLabelText("#3b82f6"))` で `onChange("#3b82f6")` が呼ばれる
  - "preset button mousedown calls preventDefault so a focused input above does not blur" — `dispatchEvent(new MouseEvent("mousedown"))` 後に `event.defaultPrevented === true`
  - "text-color reset button (Default) preventDefault on mousedown" — Text タブ + Default ボタン両方の mousedown で preventDefault
  - "embedded mode drops the wrapping border/background and uses w-full" — `inline` のみと `inline embedded` で `firstChild.className` が `border + w-[190px]` ↔ `w-full` 切替を assert
- **検証**: `cd frontend && npx tsc -b` 0 error / `npx vitest run` 35 files / 288 tests / 0 failed (新規 4 件) / 変更ファイル 3 件のうち WikiTagList.tsx:68 の `react-hooks/purity` `Math.random` lint 警告は既存コード (commit d9ebdff0, 2026-03-09) で本セッション未触の handleCreate イベントハンドラ false positive 寄り (event handler は render path 外のため実害なし) / session-verifier 全 6 ゲート PASS

#### 残課題

- **手動 UI 検証**: (a) note 内 inline WikiTag をクリック → 編集ポップアップでプリセット色 12 個 / Background タブ / Text タブ / Default リセットボタン全てクリックで panel 開いたまま色変化 / (b) WikiTag chip 同じく / (c) ピッカーが panel 幅いっぱいに広がり二重枠が消える
- **アンステージ変更の取り扱い**: 別セッション由来の `Layout/SidebarLink*.tsx` / `Mobile/materials/MobileNoteTree*.tsx` / `Mobile/MobileNoteView.tsx` / `Ideas/NoteTreeNode.tsx` / `claude_commands.rs` / `pty_manager.rs` 他 ~7 ファイルが working tree に残存。本コミットは UnifiedColorPicker 4 ファイル (実装 1 + 新規テスト 1 + WikiTag 2) + .claude/ のみに絞る
- **WikiTagList.tsx:68 既存 lint 警告**: 別タスクで一括対応 (event handler 内の Math.random は実害なし、purity rule false positive)

---

### 2026-04-25 - UnifiedColorPicker 共通化 + UI 透明度ポリシー策定 + Routine UI 群修正

#### 概要

ユーザー要望ベースの一連の UI/UX クリーンアップを 1 セッションで実施。実装計画書なしのアドホック修正群。フェーズは (a) Routine 4 バグ修正 → (b) Routine 削除時 ErrorBoundary クラッシュの根本原因 (`bulkCreateScheduleItems` 戻り値型不一致) 修正 → (c) CalendarTags のカラーピッカーを共通化 → (d) ユーザーから「CalendarTags の元実装ベースで全 UnifiedColorPicker 利用箇所を共通化、Mac 標準のコンパクト感、WikiTags の textColor タブも含める」要件追加で `UnifiedColorPicker.tsx` を全面書き換え (API 互換維持で 12 利用箇所は変更不要) → (e) ユーザー指摘から「主要 UI コンテナ背景に透明度を使わない」ポリシーを vision/CLAUDE.md に明文化 + 透明 UI 5 箇所修正、の流れ。session-verifier 全 6 ゲート PASS。

#### 変更点

- **Routine UI 4 バグ修正**:
  - `frontend/src/components/Tasks/Schedule/Routine/FrequencySelector.tsx` に `hideGroupOption?: boolean` prop 追加。`RoutineGroupEditDialog.tsx` で `hideGroupOption` を渡し、Group 自身は frequency=group を選べない（Group 自体が Group に入ることはできない仕様の UI 反映）。個別 Routine 編集側 (`RoutineEditDialog`) では従来通り "Group" 選択可能を維持
  - `frontend/src/components/Schedule/ScheduleSidebarContent.tsx` の Calendar 右サイドバーで `SearchTrigger` と `FolderDropdown` を縦並び 2 ブロックから flex 1 ブロックに統合 (検索アイコン + 残り幅で flex-1 のフォルダドロップダウン)
  - `frontend/src/components/Schedule/CalendarTagsPanel.tsx` のタイトルを `t("calendarTags.title", "Tags")` から `t("calendarTags.scheduleTitle", "Schedule Tags")` に変更、新規追加インライン UI のはみ出しを `flex-1 min-w-0` + 各ボタン/swatch に `shrink-0` で防止 + gap を `gap-1.5` → `gap-1` に圧縮
- **Routine 削除時 ErrorBoundary クラッシュの真因修正**:
  - 症状: Dayflow 内 Routine を「今回だけ削除」しただけで `Try again` 画面に落ちる。`NaN is an invalid value for the left css style property` + `Spread syntax requires ...iterable not be null or undefined — useScheduleItemsRoutineSync.ts:74` が連続発生
  - 真因: Rust 側 `db_schedule_items_bulk_create` は `Result<(), String>` を返すのに、TS 側 `DataService.bulkCreateScheduleItems` は `Promise<ScheduleItem[]>` と宣言していた。`await bulkCreate()` が undefined を返し → `[...prev, ...undefined]` で Spread エラー → `ScheduleItemsProvider` が ErrorBoundary 行き → 副次的に NaN left CSS エラーも発生
  - 修正: `frontend/src/services/DataService.ts` と `frontend/src/services/TauriDataService.ts` の `bulkCreateScheduleItems` 戻り値型を `Promise<void>` に変更。`useScheduleItemsRoutineSync.ts:71` と `useDayFlowColumn.ts:106` で `await bulkCreate(toCreate)` 後にローカルで `ScheduleItem[]` を組み立てて state に追加
- **Routine 削除 ContextMenu の NaN left CSS 修正 (前段)**: 4 ファイルで `onRequestRoutineDelete` のシグネチャを `(item, e: React.MouseEvent)` から `(item, position: { x: number; y: number })` に変更
- **`UnifiedColorPicker.tsx` 全面書き換え**: 旧 `react-colorful` HexColorPicker → CalendarTags 元実装ベースの preset 円形 grid (12 色) + native `<input type="color">` + showTextColor 時の Background/Text タブ。API 完全互換で 12 利用箇所変更不要。透明度修正 `bg-notion-bg-popover` → `bg-notion-bg`、幅 156→190px、preset 18→12 色
- **UI 透明度ポリシー策定**: `.claude/docs/vision/coding-principles.md §5` 新設、CLAUDE.md §6.4 に「主要 UI コンテナ背景に透明度禁止」追記、透明 UI 5 箇所修正 (SidebarLinkItem / CalendarTagSelector / CalendarTagsPanel / FreeSessionSaveDialog / TipsPanel)
- **Verification**: `tsc -b` 0 error / vitest 35 files / 284 tests pass / session-verifier 全 6 ゲート PASS

#### 残課題

- **D1 migration 0007 + Worker deploy は前セッション残課題のまま** (本セッションでは触らず)
- **手動 UI 検証**: Routine UI 4 件 / Dayflow Routine 削除クラッシュ / UnifiedColorPicker 12 利用箇所 / 透明度修正 5 箇所
- **既存 Tier 3 の透明度判断を保留**: ScreenLock オーバーレイは意図的半透明
- **i18n 既存問題**: `calendarTags.*` キー群は元から ja/en に未登録でフォールバック値運用
- **mockDataService.ts:343**: `bulkCreateScheduleItems: vi.fn().mockResolvedValue([])` は型上互換のため放置

---

### 2026-04-25 - Routine 削除のゴースト復活問題 + DayFlow 時間変更の Undo/Redo 全日付対応

#### 概要

ユーザー報告 2 件の Routine 関連バグ。(1) "Untitled routine" を削除しても他の日付で残ったり、削除ボタンを押していないのに突然消える。(2) DayFlow TimeGrid で routine bar をドラッグして時間変更し「ルーティンテンプレート更新」を押した後、Undo/Redo が現在表示中の日付しか戻さない。ユーザーが「根本原因が同じかも」と直感した通り、**両方とも routine の変更が複数日付の `schedule_items` に正しく伝播しない**という共通テーマだが、メカニズムは別系統（症状 A は Cloud Sync delta path 不整合、症状 B は UndoRedoManager の domain 単位 pop と未登録 IPC アクション）と判明。Rust DB layer + Frontend hooks/UI/型/テスト 9 ファイルを 1 セッションで対応。session-verifier 全 6 ゲート PASS。実装計画書を伴わない小規模バグ修正。

#### 変更点

- **症状 A 真因 — `routine_repository::soft_delete` が schedule_items を物理 DELETE していた**:
  - `src-tauri/src/db/routine_repository.rs::soft_delete` を `DELETE FROM schedule_items WHERE routine_id = ?1 AND completed = 0` から `UPDATE schedule_items SET is_deleted = 1, deleted_at = datetime('now'), version = version + 1, updated_at = datetime('now') WHERE routine_id = ?1 AND completed = 0 AND is_deleted = 0` に書き換え。物理 DELETE は Cloud Sync の `is_deleted=1 + version+1 + updated_at` delta path に乗らないため → Cloud に delete マーカーが残らない → iOS が依然として items を保持し続け Cloud に push し続ける → Desktop が pull で resurrect → ゴースト item が他の日付に出現
- **症状 A 防御層 — frontend 側の defensive guard**:
  - `frontend/src/utils/routineScheduleSync.ts::shouldCreateRoutineItem` 冒頭に `if (routine.isDeleted) return false;` 追加
  - `frontend/src/hooks/useScheduleItemsRoutineSync.ts` の `routineMap.get` lookup で `routine.isDeleted` チェック追加
- **症状 B 修正 — skipUndo オプション + grouped undo entry**:
  - `useScheduleItemsCore.ts` / `useRoutines.ts` の `updateScheduleItem` / `updateRoutine` に `options?: { skipUndo?: boolean }` 追加
  - `RoutineTimeChangeDialog::onApplyToRoutine` を全面書き換え、`push("routine", { label: "Apply routine time change", undo, redo })` で grouped entry 化。undo は当日 item revert + snapshot 内未来日 item を `getDataService().updateScheduleItem(fi.id, fi)` で順次 revert
- **検証**: `tsc -b` 0 error / vitest 35 files / 284 tests / cargo test --lib 25 passed / session-verifier 全 6 ゲート PASS

#### 残課題

- Desktop パッケージ版の更新 (cargo tauri build → /Applications 置換)
- 手動 UI 検証 (症状 A: routine 削除全日付 / 症状 B: DayFlow 時間変更 Undo/Redo)
- 既存 DB の "Untitled routine" 行は手動で trash 送り

---

### 2026-04-25 - Calendar Events パネル UX 修正 + DayCell Routine アイコン整理

#### 概要

ユーザー報告 3 件の Calendar UI バグ・UX 改善を 1 セッションで対応。(1) Events アイテムクリック時の `ScheduleItemPreviewPopup` で「終日」トグルを切り替えるたびパネルが閉じる問題を修正。(2) 終日 OFF 後の時間変更が反映されないように見える根本原因が `TimeDropdown` のポータル経由クリックで親 `BasePreviewPopup` の `useClickOutside` が誤発火する仕様だったため、ポータル側で native mousedown を `stopPropagation()`。(3) DayCell 右上の Routine (Repeat) アイコンボタンを撤去し、`+` ボタンの "Routine" メニューから既存の `RoutineManagementOverlay` を直接開く形に再配線（旧仕様: `createRoutine("Untitled routine")` で無条件作成された routine が全カレンダーセルに散らばっていた）。実装計画書を伴わない小規模 UX 修正、session-verifier 全 6 ゲート PASS。

#### 変更点

- **Issue #1 — Events パネル閉鎖防止** — `frontend/src/components/Tasks/Schedule/Calendar/CalendarView.tsx::onUpdateAllDay` から `setScheduleItemPreview(null)` を撤去 (line 866-869)。`updateScheduleItem(scheduleItemPreview.item.id, { isAllDay })` の optimistic update が `monthlyScheduleItems` を更新 → `liveScheduleItem` が新 item を解決 → `<ScheduleItemPreviewPopup>` が re-render するだけで、トグル後もパネルは開いたまま。後続の time picker 表示確認が同セッション内で可能になる
- **Issue #2 — TimeDropdown ポータルでのクリックアウト誤発火回避** — `frontend/src/components/shared/TimeDropdown.tsx` のドロップダウン (`createPortal(<div ref={dropdownRef}>...</div>, document.body)`) は React tree 上は親 popup 配下だが DOM tree 上は body 直下のため、`BasePreviewPopup::useClickOutside` (document mousedown listener + `ref.current.contains(target)` 判定) が portal 内クリックを「外」と誤判定して親パネルを閉じていた。`isOpen=true` 時のみ `dropdownRef.current` に native `addEventListener("mousedown", e => e.stopPropagation())` を仕込む `useEffect` を追加し、cleanup で `removeEventListener`。document までバブルしないため click-outside listener 自体が発火しない。WHY コメント (4 行) を添付し portal の React-tree vs DOM-tree 乖離を明記
- **Issue #3 — DayCell Routine アイコン削除 + `+` メニューから RoutineManagementOverlay へ再配線**:
  - `frontend/src/components/Tasks/Schedule/Calendar/DayCell.tsx`: `Repeat` import / `onOpenRoutineManagement?: () => void` prop / セル右上の Routine ボタン (`<button title="Routine"><Repeat size={12} /></button>`) を撤去。残るのは `+` ボタンと day number と routineCompletion バー
  - `frontend/src/components/Tasks/Schedule/Calendar/MonthlyView.tsx`: `onOpenRoutineManagement` prop と DayCell への pass-through を削除（DayCell が必要としないため）
  - `frontend/src/components/Tasks/Schedule/Calendar/CalendarView.tsx`: `useScheduleContext()` の destructure から未使用化した `createRoutine` を削除 / `<MonthlyView>` への `onOpenRoutineManagement` 渡しを削除 / `<CreateItemPopover onSelectRoutine={...}>` を `createRoutine("Untitled routine")` 直接呼びから `onOpenRoutineManagement?.()` 起動に変更。`onOpenRoutineManagement` 未提供時は三項で `undefined` を渡し、`CreateItemPopover.BASE_ITEMS.filter(({ key }) => handlers[key] !== undefined)` の既存仕様で "Routine" 項目自体が非表示になる一貫性を保つ
- **Verification**: `cd frontend && npx tsc -b` 0 error / `npx vitest run` 35 files / 283 tests / 0 failed / 変更 4 ファイルの ESLint 新規エラー 0（TimeDropdown line 138 の `react-hooks/refs "Cannot access refs during render"` は私の変更前から既存、`git stash` で baseline を確認: 旧 line 125 で同一エラー） / session-verifier 全 6 ゲート PASS

#### 残課題

- **手動 UI 検証**: Calendar Events 終日トグル → 連続的にトグル ON/OFF してもパネルが閉じない / 終日 OFF 後に start/end TimeDropdown を選択してもパネルが閉じず時刻が反映される / DayCell の `+` ボタン → "Routine" → `RoutineManagementOverlay` が開く
- **既存の "Untitled routine" 行**: 旧仕様で DB に既に作成された Untitled routine 行は手動で trash へ送る必要あり（生成経路は塞いだだけで、既存データには触れない）
- **アンステージ変更の取り扱い**: 別セッション由来の `Layout/SidebarLink*.tsx` / `Mobile/materials/MobileNoteTree*.tsx` / `Schedule/CalendarTagsPanel.tsx` 他 ~17 ファイルが working tree に残存。本コミットは Calendar UX 関連 4 ファイル + .claude/ のみに絞る

---

### 2026-04-25 - Cmd+K コマンドパレット統合（セクション動的アイテム + Sidebar Links + UI 拡大）

#### 概要

ユーザー要件「現在の検索フィールドや Component / hooks を Cmd+K で開くコマンドパレットと統合したい」に対する実装。要件は (1) 必ず表示するのは 6 セクション + 追加した Sidebar リンクアイテム、(2) 各セクションを開いているものに応じた動的アイテムを上乗せ、(3) パネルを大きく中央寄りに、(4) RightSidebar の検索フィールドは削除しアイコンのみ残す、の 4 点。事前確認（Q1: 既存コマンド「そのまま残す」/ Q2: 一気に全 6 セクション対応 / Q3: 680px×480px×pt-12vh で OK / Q4: 検索アイコンを Cmd+K トリガに変更）に基づき、UI 拡大 → Sidebar Links 注入 → セクション別動的コマンド hook 新設 → 10 箇所の `<SearchBar>` を `<SearchTrigger>` に置換 の 4 段階で実装。`tsc -b` 0 error / vitest 283/283 pass / `npm run build` 成功。本実装は実装計画書を伴わず、事前 Q&A での合意ベースで進行。

#### 変更点

- **CommandPalette UI 拡大** — `frontend/src/components/CommandPalette/CommandPalette.tsx` のパネル `max-w-[520px]` → `max-w-[680px]` (約 +30% 幅)、コマンドリスト `max-h-[320px]` → `max-h-[480px]` (約 +50% 高)、起動位置 `pt-[15vh]` → `pt-[12vh]` で中央寄り。検索 input / カテゴリ見出し / アイテム配色等は既存維持。
- **Sidebar Links を Links カテゴリに動的注入** — `frontend/src/hooks/useAppCommands.ts` で `useSidebarLinksContext()` を購読し、`!isDeleted` リンクを Navigation 直後（Settings deep links より前）に挿入。
- **セクション別動的アイテム hook を新設** — `frontend/src/hooks/useSectionCommands.ts` 新規。`useTaskTreeContext` / `useDailyContext` / `useNoteContext` / `useScheduleContext` を集約して動的 Command[] を返す。Schedule + tasks / events / calendar、Materials + notes / daily の各カテゴリ。
- **App.tsx で baseCommands と sectionCommands を統合** — `useAppCommands(...)` を `baseCommands` に rename、`useSectionCommands(...)` を呼び `[...sectionCommands, ...baseCommands]` で結合。
- **RightSidebar の検索フィールドを Cmd+K トリガに置換** — 新規 `frontend/src/components/shared/SearchTrigger.tsx`。`OPEN_COMMAND_PALETTE_EVENT` を `window.dispatchEvent` で発火、App.tsx 側で listen。
- **10 箇所の `<SearchBar>` 置換 + dead code 整理** — Schedule / Ideas / Work / Settings 配下の `SearchBar` を `SearchTrigger` に置換し、付随する filter useMemo / suggestions useCallback を全削除。
- **検証**: `tsc --noEmit` 0 / vitest 283 passed / `npm run build` Exit 0。session-verifier は本セッションでは未実行。

#### 残課題

- **手動 UI 検証**: Cmd+K で 6 セクション + Sidebar Links + Schedule タブ別動的アイテム + Materials の最近のノート / Daily が表示・遷移できるか
- **Connect / Work / Analytics / Settings の動的アイテム**: 今回は基本ナビ + Settings deep links のみ
- **Routine Tag → Group 移行との並行コミット範囲分離**

---

### 2026-04-25 - Routine Tag 廃止 + Group 中心の再設計（V69 + D1 0007）

#### 概要

Routine の Tag 機能（`routine_tag_definitions` / `routine_tag_assignments` / `routine_group_tag_assignments`）を完全廃止し、Routine ↔ RoutineGroup を直接 junction で結ぶ新モデルに移行。Routine の `frequencyType` に `"group"` を追加し、`group` を選んだ Routine は所属 Group の frequency 設定（daily / weekdays / interval）を OR で継承する。EditRoutineDialog で frequency=group を選択時、既存 Group 多重選択 + その場で新規 Group 作成（name + color + frequency 全部入力）を inline で行えるように実装。Backend / Cloud Sync / UI / i18n / テストを 8 Phase で完了。計画書 `.claude/2026-04-25-routine-group-migration.md` を archive 移動。

#### 変更点

- **Phase 1 — DB Migration V69 / D1 0007**:
  - `src-tauri/src/db/migrations/v61_plus.rs` に V69 ブロック追加: `DROP TABLE IF EXISTS routine_tag_definitions / routine_tag_assignments / routine_group_tag_assignments` + `CREATE TABLE routine_group_assignments(id PK / routine_id FK CASCADE / group_id FK CASCADE / created_at / updated_at NOT NULL / is_deleted / deleted_at, UNIQUE(routine_id, group_id))` + 3 INDEX (`idx_rga_routine` / `idx_rga_group` / `idx_rga_updated_at`)。CalendarTag V65 と同じ pattern（id PK + own updated_at + soft-delete）。
  - `src-tauri/src/db/migrations/mod.rs::LATEST_USER_VERSION` を 68 → 69 に更新、orphan list に `routine_tag_definitions` / `routine_tag_assignments` / `routine_group_tag_assignments` を追加、`v69_drops_routine_tag_tables_and_creates_group_assignments` + `v69_upgrade_path_drops_seeded_routine_tag_data` の 2 統合テスト追加。
  - `cloud/db/migrations/0007_drop_routine_tags_add_group_assignments.sql` 新規 — D1 側 mirror、`server_updated_at` 列付き + 4 INDEX。Apply 順序: migration FIRST → Worker deploy SECOND。
- **Phase 2 — Backend DB Layer**:
  - 削除: `src-tauri/src/db/routine_tag_repository.rs` 全廃。
  - 修正: `src-tauri/src/db/routine_group_repository.rs` から `fetch_all_tag_assignments` / `set_tags_for_group` 削除。
  - 新規: `src-tauri/src/db/routine_group_assignment_repository.rs` — `fetch_all` (`is_deleted=0` のみ返却) / `set_groups_for_routine(conn, routine_id, group_ids[])` (差分 upsert + soft-delete 復活 + parent routine の version+1 / updated_at bump) を `helpers::now()` + `new_uuid()` で実装。CalendarTag pattern 踏襲。
  - `src-tauri/src/db/mod.rs` の mod 宣言を入れ替え。
- **Phase 3 — Backend Commands & lib.rs**:
  - 削除: `src-tauri/src/commands/routine_tag_commands.rs` 全廃。
  - 修正: `src-tauri/src/commands/routine_group_commands.rs` から `db_routine_groups_fetch_all_tag_assignments` / `db_routine_groups_set_tags_for_group` 削除。
  - 新規: `src-tauri/src/commands/routine_group_assignment_commands.rs` — `db_routine_group_assignments_fetch_all` + `db_routine_group_assignments_set_for_routine(routine_id, group_ids)`。
  - `src-tauri/src/commands/mod.rs` mod 宣言入れ替え + `src-tauri/src/lib.rs::generate_handler!` から routine*tag*_ 6 個 + routine*groups の tag 関連 2 個を削除、新規 routine_group_assignment*_ 2 個を追加（IPC 4 点同期完了）。
- **Phase 4 — Cloud Sync 同期対象更新**:
  - `src-tauri/src/sync/types.rs::SyncPayload` から `routine_tag_assignments` / `routine_group_tag_assignments` / `routine_tag_definitions` フィールド削除、`routine_group_assignments: Vec<Value>` 追加。
  - `src-tauri/src/sync/sync_engine.rs` の delta query / collect_all / apply 各箇所から旧 3 テーブルを削除し `routine_group_assignments` を CalendarTag と同じく自己 `updated_at` ベースの delta query で扱う。`ROUTINE_GROUP_ASSIGNMENTS_TABLE` const + `insert_or_replace` 経由で apply。
  - `cloud/src/config/syncTables.ts` の `RELATION_TABLES_WITH_UPDATED_AT` に `routine_group_assignments` 追加、`RELATION_TABLES_NO_UPDATED_AT` から旧 3 テーブルを削除し `calendar_tag_definitions` のみ残す。`RELATION_PK_COLS` に `routine_group_assignments: ["id"]` 追加。`RELATION_PARENT_JOINS` を空配列化（routine*tag*\* 廃止に伴い parent-join 経路自体が不要に）。`TAG_DEFINITION_TABLES` から `routine_tag_definitions` 削除。
- **Phase 5-6 — Types / Service**:
  - 削除: `frontend/src/types/routineTag.ts` 全廃。
  - `frontend/src/types/routine.ts::FrequencyType` に `"group"` 追加、`RoutineNode` に `groupIds?: string[]` フィールド追加（DB 上は junction、frontend 上は導出フィールド）。
  - `frontend/src/types/routineGroup.ts` から `RoutineGroupTagAssignment` 削除、`RoutineGroupAssignment` interface 新設（id / routineId / groupId / createdAt / updatedAt / isDeleted / deletedAt）。
  - `frontend/src/services/DataService.ts` interface から `fetchRoutineTags` / `createRoutineTag` / `updateRoutineTag` / `deleteRoutineTag` / `fetchAllRoutineTagAssignments` / `setTagsForRoutine` / `fetchAllRoutineGroupTagAssignments` / `setTagsForRoutineGroup` の 8 メソッド削除、`fetchAllRoutineGroupAssignments() / setGroupsForRoutine(routineId, groupIds)` の 2 メソッド追加。
  - `frontend/src/services/TauriDataService.ts` を同シグネチャに更新（invoke ブリッジ）。
- **Phase 7 — Hook / Context**:
  - 削除: `frontend/src/hooks/useRoutineTags.ts` / `useRoutineTagAssignments.ts` / `useRoutineGroupTagAssignments.ts` の 3 hook 全廃。
  - 新規: `frontend/src/hooks/useRoutineGroupAssignments.ts` — `Map<routineId, groupId[]>` 管理 + `setGroupsForRoutine` (optimistic update + UndoRedo + DataService 永続化) + `getGroupIdsForRoutine` / `getRoutineIdsForGroup` / `removeRoutineAssignments`。初期ロード中の書き込みガード + cancelled flag による async cleanup。
  - `frontend/src/hooks/useRoutineGroupComputed.ts` を `routineGroupAssignments: Map<string, string[]>` を直接消費する形に書き換え（旧: tag set intersection → 新: 直接メンバーシップ参照）。
  - `frontend/src/context/RoutineContextValue.ts` / `RoutineContext.tsx` の Provider 構成を新 hook で組み直し、`deleteRoutine` のラッパー（undo で prevGroupIds を復元）も新 API に追従。
  - `frontend/src/utils/routineScheduleSync.ts::shouldCreateRoutineItem` を新セマンティクス（`frequencyType==="group"` 時に Group 群の frequency を OR 評価、Group 未割当なら fire しない / それ以外は routine 自体の frequency を使い group は無視）に書き換え + `tagAssignments` 引数を全シグネチャから除去。`useScheduleItemsRoutineSync.ts` 全 callsite を追従。
- **Phase 8 — UI**:
  - 削除: `frontend/src/components/Tasks/Schedule/Routine/{RoutineTagManager, RoutineTagEditPopover, RoutineTagSelector, RoutineGroupTagPicker}.tsx` 4 ファイル全廃。
  - `FrequencySelector.tsx` のタイプ切替ボタンに `"group"` を追加（`flex-wrap` で折り返し対応）。
  - `RoutineEditDialog.tsx` を全面書き換え: `tags` / `initialTagIds` / `onCreateTag` props を撤去し、`routineGroups` / `initialGroupIds` / `onCreateGroup` を受け取る形に変更。`frequencyType==="group"` 選択時に inline サブパネルが展開され、(a) 既存 Group をピル UI で多重選択 / (b) 「+ 新規 Group 作成」で同 Dialog 内に Group 作成フォーム（name / color picker / frequency selector）が展開され、作成成功時に自動選択。"group" の Routine 保存時は frequencyDays/Interval/StartDate を null/[] で永続化。
  - `RoutineGroupEditDialog.tsx` から tag picker 完全撤去、メンバー一覧は `memberRoutines` prop からのみ取得（旧: 選択 tag からの動的計算は廃止）。Group 自体の `frequencyType` が `"group"` を取らないよう coerce。
  - `RoutineManagementOverlay.tsx` から「Tag 管理」ボタン + RoutineTagManager + tag 関連 props 全撤去、Routine 行の tag chips を group chips に置換、`onCreateRoutineGroup` を inline 引数で受け取り `onCreateGroup` callback として RoutineEditDialog に渡す。
  - `Schedule/ScheduleSidebarContent.tsx` / `Schedule/ScheduleItemEditPopup.tsx` / `Tasks/Schedule/Calendar/CalendarView.tsx` / `Tasks/Schedule/DayFlow/{OneDaySchedule, CompactDateNav, DualDayFlowLayout}.tsx` / `hooks/useDayFlowColumn.ts` / `context/ScheduleItemsContext.tsx` の 8 ファイルから `routineTags` / `tagAssignments` / `setTagsForRoutine` / `createRoutineTag` 等の参照を一掃し、`routineGroupAssignments` / `setGroupsForRoutine` / `createRoutineGroup` を新 API として接続。filter UI も tag chips → group chips 一本化。
- **Phase 9-11 — i18n / Tests / 検証**:
  - `frontend/src/i18n/locales/en.json` / `ja.json` から `schedule.routineTag` / `noTaggedRoutines` / `manageTags` / `createTag` / `tagName` / `deleteTagConfirm` / `routineGroup.assignedTags` / `routineGroup.noTags` / `routineGroup.frequencyOverrideWarning` 等の tag 関連キーを削除し、`schedule.frequencyGroup` / `routineGroup.assignToGroup` / `routineGroup.createNew` / `routineGroup.noGroupsHint` / `routineGroup.untitled` / `routineGroup.create` を ja+en に追加。
  - `frontend/src/hooks/useRoutineGroupComputed.test.ts` を新 API（`routineGroupAssignments: Map<string, string[]>`）に追従、6 ケース更新。
  - 新規: `frontend/src/utils/routineScheduleSync.test.ts` — `shouldCreateRoutineItem` の V69 group セマンティクスに対する 7 ケース（daily / weekdays が group 影響受けない / group OR / no groups で fire しない / hidden group skip / archived 不発火 / interval が group 無視）。
- **Verification**: `cd src-tauri && cargo test --lib` 23 passed (`v69_*` 2 件含む) / `cd frontend && npx vitest run` 283 passed (新規 routineScheduleSync.test.ts 7 + 既存 276) / `tsc -b` (frontend) は私の変更ファイルで 0 error / `npx tsc --noEmit` (cloud) clean / `cargo check` clean / 変更ファイル ESLint 0 error。session-verifier 全 6 ゲート PASS。
- **計画書 archive**: `.claude/2026-04-25-routine-group-migration.md` の Status を `COMPLETED` に更新後、`.claude/archive/` へ移動。
- **コミット範囲分離**: ユーザーの並行作業（CommandPalette / SearchTrigger / Sidebar 検索 refactor 関連の TS6133 / TS2304 が `App.tsx` / `ScheduleSection.tsx` / `Settings.tsx` / `*Sidebar.tsx` 等に残存）は本セッション範囲外のため未ステージ。本コミットは Routine Tag→Group 移行の 41 ファイル + plan archive に限定。

#### 残課題

- **D1 migration 0007 適用 + Worker deploy**: `cd cloud && npx wrangler d1 execute life-editor-sync --remote --file=./db/migrations/0007_drop_routine_tags_add_group_assignments.sql` → `npm run deploy` の順序で本番反映（逆順だと旧 schema に新 Worker が当たり 500）。
- **手動 UI 検証**: Desktop で V69 自動 apply 確認（`PRAGMA user_version` = 69 / `routine_tag_*` テーブル消失 / `routine_group_assignments` 新設）→ 既存 Routine が表示される（Tag UI 消失）→ frequencyType=Group 選択 + 既存 Group 多重選択保存でカレンダーに正しく出現 → 「+ 新規 Group 作成」flow で inline 作成 + 自動選択 → Cloud Sync で iOS と双方向に伝搬。
- **ユーザー並行作業の TS エラー解消**: 別コミットで対応（CommandPalette / SearchTrigger / SectionCommands 関連の `sidebarSearchQuery` undefined / 未使用変数）。

---

### 2026-04-25 - Materials/iOS Notes アイテム名表示クリーンアップ

#### 概要

ユーザー報告 2 件の単発バグ修正。(1) Desktop Materials 右サイドバーで、ノートのアイテム名が「タイトル名」と「本文中の最初の見出し」の混在表示になっていた → 常に title を使う形に統一。(2) iOS Notes リストで Tag 名のピルや Pin (Heart) アイコンがタイトル名を圧迫していた → Pin を Note アイコン位置に移動 (Desktop と同パターン)、Tag ピルを撤去して `+N` バッジのみ残しタイトルとの隣接を回避、Lock アイコンは右端に再配置、Favorites セクションの本文プレビュー (24 文字) を撤去。実装計画書を伴わない小規模 UI 修正、検証は session-verifier 全 6 ゲート PASS。

#### 変更点

- **Desktop `frontend/src/components/Ideas/NoteTreeNode.tsx`** — タイトル span 内の `(node.type !== "folder" && extractFirstHeading(node.content)) || node.title || "Untitled"` を `node.title || "Untitled"` に簡略化 (本文先頭見出しのフォールバックを撤去)。未使用となった `extractFirstHeading` import を削除。`utils/tiptapText.ts::extractFirstHeading` の export 自体は test 利用があるため残置 (production 参照は 0)
- **iOS `frontend/src/components/Mobile/materials/MobileNoteTreeItem.tsx` 全面再構成** — Note/Folder アイコン部 (`isFolder ? Folder : StickyNote`) を `isFolder ? Folder : isPinned ? Heart : StickyNote` の三項に変更し Pin (Heart) を icon position に移動 (Desktop の `NoteTreeNode.tsx` と同パターン) / 旧 visibleTags (最大 2 件) のピルレンダリング `tags.slice(0, 2).map(...)` を撤去し、`tagCount = wikiCtx?.getTagsForEntity(node.id).length ?? 0` を計算して `+{tagCount}` バッジ 1 つのみタイトル後ろに表示 / Lock アイコンを右端に再配置 (renderExtra 自体を削除したため実質 li 末尾) / `renderExtra?: (node) => ReactNode` prop と `{renderExtra?.(node)}` 呼び出しを撤去
- **`frontend/src/components/Mobile/materials/MobileNoteTree.tsx`** — `renderExtra` prop を Props インターフェースから削除 + 子 `MobileNoteTreeItem` および再帰 `MobileNoteTree` への伝播を撤去
- **`frontend/src/components/Mobile/MobileNoteView.tsx`** — Favorites セクション (`pinnedNotes.map`) で `MobileNoteTreeItem` に渡していた `renderExtra={() => <span>{extractPlainText(note.content).slice(0, 24)}</span>}` を完全削除 / 同ファイル内 private 関数 `extractPlainText(content: string): string` (try parse JSON → block.content[].text join → slice 120) を不要になったため削除
- **検証**: tsc -b 0 error / vitest 268/268 pass / 自セッション 4 ファイルの ESLint 0 error。残 4 件の lint error はすべて `NoteTreeNode.tsx:293` の既存 `iconRef.current?.getBoundingClientRect()` (IconPicker anchorRect 用、react-hooks/refs `Cannot access refs during render`) で MEMORY.md「Frontend 既存 lint 116 問題の一括解消」既知 finding。session-verifier 全 6 ゲート PASS

#### 残課題

- **手動 UI 検証**: iOS シミュレータ / Tauri build で Materials サイドバーと Mobile Notes リストの表示を目視確認 (アイコン位置・タグバッジ・Lock 配置・タイトル切り取り挙動)
- **アンステージ変更の取り扱い**: 別セッション由来の `Layout/SidebarLinkAddDialog.tsx` / `Layout/SidebarLinkItem.tsx` / `Layout/lucideIconRegistry.ts` (新規) が working tree に残存。本セッションでは触らず (Q2 Phase D の続きと推測)、別 commit で扱う想定

---

### 2026-04-25 - Cloud Sync 本番 deploy + D1 migration 全適用 + 0006 hotfix で `calendar_tag_assignments` legacy schema 解消

#### 概要

前セッションで作成された 0006 hotfix migration の適用と、Worker 04-17 deploy → 最新化を含む Cloud Sync 本番反映を 1 セッションで実施。Desktop UI で `Connection failed` を発端に、Cloudflare の知識整理 → SYNC_TOKEN ローテーション (`wrangler secret put`) → curl POST /auth/verify で 200 確認 → D1 migration 0003/0004/0005 順次 apply → `npm run deploy` で Worker を 8 commits 分最新化 (auth timing-safe / sync routes split / Known Issues 011-014 修正反映)。Sync Now 実行で 500 を観測、`wrangler tail` で `D1_ERROR: no such column: server_updated_at at offset 63` を捕捉、`pragma_table_info` 一括検証で sync 対象 15 テーブル中 `calendar_tag_assignments` のみ legacy schema 残存と特定。0006 を適用し V65 shape (`id PK + entity_type + entity_id + tag_id + updated_at + server_updated_at`) に rebuild 完了。原因（D1 transactional rollback 保証下での部分適用）は特定不能、Known Issue 016 起票候補。本セッションでのコード変更は `cloud/db/migrations/0006_fix_cta_server_updated_at.sql` の rebuild 版書き換え 1 ファイルのみ、他は本番 state の修復作業。

#### 変更点

- **`cloud/db/migrations/0006_fix_cta_server_updated_at.sql` 書き換え** — 前セッションで作成された ALTER 単独版を rebuild 完全版に書き換え。`PRAGMA table_info` で 旧 schema (`schedule_item_id, tag_id` 複合 PK + `updated_at` 列なし) と判明したため、ALTER ベースの修復は不可能。0004 の `_v2` rebuild セクション（CREATE TABLE IF NOT EXISTS + INSERT OR IGNORE FROM old + DROP + RENAME + 3 INDEX）を独立 migration として抽出
- **本番 D1 migration 適用**: `cd cloud && npx wrangler d1 execute life-editor-sync --remote --file=./db/migrations/{0003,0004,0005,0006}.sql` を順次実行。検証 `pragma_table_info` 一括クエリで sync 対象 15 テーブル全てに `server_updated_at` 列が揃ったことを確認 (0006 適用後)
- **本番 Worker 最新化**: `npm run deploy` で 04-17 → 最新 (`599133e refactor(cloud): split sync.ts ...` 含む 8 commits) を反映。auth が timing-safe SHA-256 化、sync routes が `versioned.ts` / `relations.ts` / `shared.ts` に分割、`calendar_tag_assignments` の `RELATION_TABLES_WITH_UPDATED_AT` 昇格などが反映
- **SYNC_TOKEN ローテーション**: 旧 token 不明のため `wrangler secret put SYNC_TOKEN` で新規 hex 64 文字を再投入。curl POST `/auth/verify` で `{"valid":true,"serverTime":...}` 確認後、Desktop UI 側にも同 token を貼って Connect 成功
- **副次: Cloudflare 知識整理** — 本セッションの初動で「Cloudflare の役割が分からない」要件あり、web-researcher で 2025-2026 最新情報を調査・要約 (Workers / D1 / KV / R2 / DO / Queues / Wrangler / 料金 free vs paid / Smart Placement / Containers Beta / Pages 統合)。本リポジトリには未保存（チャット内のみ）
- **Verification**: 0006 適用後に `pragma_table_info('calendar_tag_assignments')` で 7 列 (id / entity_type / entity_id / tag_id / created_at / updated_at / server_updated_at) を確認 / Worker tail で 500 が止むことを確認 (Sync Now 実走による最終確認は user 側で残課題)

#### 残課題

- **手動 UI 検証**: Desktop で Sync Now → Last error が消えること、Connected 表示で sidebar_links / calendar_tag_assignments / dailies / notes が iOS と双方向に伝搬すること
- **Known Issue 016 起票候補**: D1 0004 multi-statement migration が transactional rollback 下で部分適用された原因の調査・記録。再現条件不明、`docs/known-issues/_TEMPLATE.md` ベースで Active 起票が妥当。session 中に特定できた事実: (a) 0004 の calendar_tag_definitions ALTER 部分は適用された / (b) calendar_tag_assignments rebuild 部分は未適用のまま残った / (c) wrangler の transactional rollback 保証メッセージと矛盾する状態
- **計画書アーカイブなし**: 本セッションは production state 修復のみで実装計画書を伴わない作業

---

### 2026-04-25 - Work UX 補強（History タブ + 完了 Toast）+ V68 FREE CHECK バグ修正 + D1 0004 apply

#### 概要

ユーザー報告「Work で作業時間を記録する UI/UX がない」に対する Explore 調査で、`timer_sessions` への保存は機能しているが「保存されたセッションを見る場所が無い」のが本質的不足と判明。Work タブに History タブを追加し、Pomodoro 完了時の Toast を実装。さらに Free session ボタンが `CHECK constraint failed` で起動不能だった既存バグ (Phase B 計画書では CHECK 制約 "元々無し" と誤認していたが full_schema.rs に存在) を V68 migration で修正。Sync 500 の原因は D1 の `calendar_tag_assignments` が旧スキーマ (schedule_item_id, tag_id PK) のまま残っており、新クライアントの新スキーマ push が失敗していたため、修復用 migration `0006_fix_cta_server_updated_at.sql` を作成 + `0004` を D1 remote に apply 完了。Worker deploy は user 実行待ち。検証: cargo test 21 passed / vitest 268 passed / tsc -b + cargo check + 変更ファイル ESLint 全 clean。

#### 変更点

- **🐛 V68 migration: timer_sessions.session_type CHECK に 'FREE' 追加**:
  - `src-tauri/src/db/migrations/v61_plus.rs` に V68 ブロック追加 — `sqlite_master.sql` を読んで `'FREE'` を含むかで `needs_rebuild` 判定 (冪等)、必要なら `timer_sessions_v2` を新 CHECK で create → `INSERT SELECT` で全行コピー → `DROP` + `RENAME` + `idx_timer_sessions_task` 再作成
  - `src-tauri/src/db/migrations/full_schema.rs` の `timer_sessions.session_type CHECK` 行を `('WORK','BREAK','LONG_BREAK','FREE')` に同期 (fresh DB は full_schema → V61 jump → V66 (label) → V68 (CHECK 確認 = skip) を通る)
  - `src-tauri/src/db/migrations/mod.rs` の `LATEST_USER_VERSION = 67 → 68` バンプ + 統合テスト 2 件追加 (`v68_allows_free_session_type`: FREE での INSERT が CHECK を通る / `v68_preserves_existing_timer_sessions_during_rebuild`: V65 状態の DB に WORK 行を仕込んで migration 後に row 保持を確認)
  - **背景**: Phase B で TS / Rust に "FREE" を追加したが DB 側 CHECK の更新を見落とし、Free session ボタンを押した瞬間に `CHECK constraint failed: session_type IN ('WORK','BREAK','LONG_BREAK')` で起動不能だった
- **A: Work History タブ**:
  - `frontend/src/components/Work/WorkHistoryContent.tsx` 新規 — `getDataService().fetchTimerSessions()` を mount 時 1 回 fetch (cancelled flag で cleanup)、`useTaskTreeContext().nodes` から task 名を解決、直近 14 日の `WORK` / `FREE` 完了セッションを日別バケットに集計 (date desc + within-day time desc)、各日に「件数 · 合計時間」表示、セッション行に sessionType 色ドット + task title (or label or "Free session") + `HH:MM · sessionTypeLabel` + `formatDuration(sec)`、上部に「Last 7 days: {合計}」サマリーカード、空時 placeholder 表示
  - `frontend/src/components/Work/WorkScreen.tsx` — `WORK_TABS` に `{ id: "history", labelKey: "work.tabHistory", icon: HistoryIcon }` を Timer と Music の間に追加、`activeTab === "history"` の分岐で `<WorkHistoryContent />` を render
- **C: Pomodoro 完了 Toast**:
  - `frontend/src/hooks/useSessionCompletionToast.ts` 新規 — `useTimerContext().completedSessions` を `useRef` で前回値保持 + useEffect で増加検出 (timerReducer は WORK 完了時のみ increment するので WORK 限定で発火)、`useToast().showToast("success", "✓ Recorded {min}min to {task}")` を呼ぶ。task title 不在時は `"✓ Recorded {min}min"`。Strict Mode の double effect でも prevRef 書き戻しが冪等
  - `WorkScreen.tsx` / `frontend/src/components/Mobile/MobileWorkView.tsx` の両方で `useSessionCompletionToast()` を呼ぶ
  - `frontend/src/hooks/useSessionCompletionToast.test.ts` 新規 (4 cases: 初回レンダーで発火しない / 増加で task 名付き Toast / activeTask null で task 名なし Toast / 同値で発火しない)
- **🐛 Sync 500 対処 (D1 schema 不整合)**:
  - 原因: D1 remote に `sidebar_links` は前回作成済だが、`calendar_tag_assignments` が旧 PK スキーマ (schedule_item_id, tag_id) のまま残っており、最新 client の `INSERT INTO calendar_tag_assignments (id, entity_type, entity_id, ...)` が `no such column` で失敗 → batch 全ロールバック → 500
  - `cloud/db/migrations/0006_fix_cta_server_updated_at.sql` 新規 — 0004 の CTA rebuild セクションだけを独立 migration として抽出 (CREATE `_v2` → `INSERT OR IGNORE SELECT` で旧行を MIN(tag_id) collapse + `entity_type='schedule_item'` 移行 → DROP/RENAME → 3 INDEX)。`CREATE TABLE IF NOT EXISTS` で安全側
  - `wrangler d1 execute life-editor-sync --remote --file=./db/migrations/0004_calendar_tags_v65.sql` を実行 → `changed_db: true / rows_written: 40` で apply 成功
  - **Worker deploy は user 実行待ち** (`cd cloud && npm run deploy`)。最新 `syncTables.ts` は CTA を `RELATION_TABLES_WITH_UPDATED_AT` に昇格しているため deploy しないと D1 修復後も誤動作する可能性
- **i18n**: `work.tabHistory` (`History` / `履歴`) / `work.history.{last7Days, empty}` / `work.toast.{recordedToTask, recordedFreeWork}` を `en.json` + `ja.json` 両方に追加
- **Verification**: `cd src-tauri && cargo test` 21 passed / 1 ignored / 0 failed (新規 V68 統合テスト 2 件含む) / `cd frontend && npx vitest run` 268 passed / 0 failed (32→33 test files、新規 useSessionCompletionToast.test.ts 4 件) / `cd frontend && npx tsc -b` 0 error / `cd src-tauri && cargo check` clean / 変更ファイル ESLint 0 error / session-verifier 全 6 ゲート PASS

#### 残課題

- **Worker deploy 未実行**: `cd cloud && npm run deploy` は user 実行待ち (D1 への直接 apply は許可ポリシーで拒否されるため)。deploy しないと最新 `syncTables.ts` の `RELATION_TABLES_WITH_UPDATED_AT` 昇格が反映されず、D1 0004/0006 適用後も誤動作の可能性
- **Desktop パッケージ版 V68 未到達**: `/Applications/Life Editor.app` は dev binary でなければ古い CHECK 制約のまま。Free session を試すには `cargo tauri dev` か `cargo tauri build` で更新が必要
- **手動 UI 検証**: Work タブ History 画面で過去セッション一覧表示 / Pomodoro 25min 完了で右下に Toast 出る / Free session 開始 → 停止 → SaveDialog 表示 (CHECK 制約エラー無し) を確認

---

### 2026-04-25 - Q2 機能パッチ Phase D 完了 + Phase A Cloud Sync 着地（Sidebar Links + CalendarTags D1 追従）

#### 概要

計画書 `.claude/2026-04-25-sidebar-tags-free-pomodoro.md` の最終 2 タスクを 1 セッションで実装し、計画書を archive へ移動。Phase A 残 (CalendarTags Cloud Sync) は D1 migration 0004 で `calendar_tag_definitions` を Cloud Sync 対応 (created_at/updated_at/version/is_deleted/server_updated_at) + `calendar_tag_assignments` を新スキーマに rebuild、`syncTables.ts` で `RELATION_TABLES_WITH_UPDATED_AT` に昇格 (entity_type が task/schedule_item の二択で単一親 JOIN が一意でないため`RELATION_PARENT_JOINS` から削除)。Phase D (Sidebar Links) は V67 migration で `sidebar_links` テーブル新設、Rust 側 repository / commands / system_commands 拡張 / lib.rs handler 登録、Frontend は Pattern A 4 ファイル + 2 component (Item / AddDialog) + LeftSidebar 統合 + BrowserSettings + MobileApp Drawer 統合 + Cloud Sync 7 接点 (sync_engine / VERSIONED_TABLES / D1 0005)。検証: cargo test 19/19 / vitest 257→264 (新規 useSidebarLinks.test.ts 7 test) / tsc -b + cargo check + cloud tsc 全 clean。**全 Phase 完了** (`COMPLETED 2026-04-25` で archive 移動)。

#### 変更点

- **Phase A 残 — CalendarTags Cloud Sync**:
  - `cloud/db/migrations/0004_calendar_tags_v65.sql` 新規 — `calendar_tag_definitions` に `created_at/updated_at/version/is_deleted/deleted_at/server_updated_at` を nullable で ALTER ADD + UPDATE 経由 backfill (D1 の ALTER は constant default のみのため二段階)、`calendar_tag_assignments` を `_v2` 経由で `id PK / entity_type CHECK / entity_id / tag_id / updated_at / server_updated_at` に rebuild、旧 schedule_item 行は `MIN(tag_id)` で 1:1 collapse + `entity_type='schedule_item'` で migrate、INDEX 4 本再構築
  - `cloud/src/config/syncTables.ts` — `calendar_tag_assignments` を `RELATION_TABLES_NO_UPDATED_AT` から `RELATION_TABLES_WITH_UPDATED_AT` に移し、`RELATION_PK_COLS` に `["id"]` 追加、`RELATION_PARENT_JOINS` から `calendar_tag_assignments` を削除 (entity_type が task/schedule_item の二択で単一親 JOIN が一意でない構造的事情を意図コメントで明記)
- **Phase D — Sidebar Links + Browser/App settings**:
  - **DB V67**: `src-tauri/src/db/migrations/v61_plus.rs` に `sidebar_links` テーブル新設 (id PK + kind('url'\|'app') CHECK + name + target + emoji + sort_order + version + LWW columns + 3 INDEX) / `migrations/mod.rs` の `LATEST_USER_VERSION = 67` にバンプ + `v67_creates_sidebar_links_table` 統合テスト追加
  - **Rust**: `src-tauri/src/db/sidebar_link_repository.rs` 新規 (CRUD + reorder, 5 unit test) / `src-tauri/src/commands/sidebar_link_commands.rs` 新規 (5 IPC: fetch_all / create / update / delete / reorder) / `src-tauri/src/commands/system_commands.rs` 拡張で `BROWSER_CANDIDATES` const (Chrome/Safari/Firefox/Edge/Arc/Brave) + `system_list_browsers` (`/Applications/*.app` 存在チェックで installed のみ返却) + `system_list_applications` (`/Applications` 列挙、ソート済) + `system_open_url(url, browser_id?)` (browser_id 指定時は `open -a path url`、未指定/未インストール時は `open::that` で system default に fallback) + `system_open_app(app_path)` を追加。すべて `#[cfg(target_os = "macos")]` ガード、iOS では空配列 / `Err("Launching applications is only supported on macOS")` 返却 / `lib.rs` handler に 9 件登録 / `commands/mod.rs` + `db/mod.rs` に新 module 追加
  - **Cloud Sync**: `src-tauri/src/sync/types.rs` の `SyncPayload` に `sidebar_links` field 追加、`src-tauri/src/sync/sync_engine.rs` の `VERSIONED_TABLES` に `("sidebar_links", "id")` 追加 + `collect_local_changes` に `query_changed("sidebar_links")` 行追加 + `get_payload_field` / `set_payload_field` の match arm 追加 / `cloud/db/migrations/0005_sidebar_links.sql` 新規 (server_updated_at + 4 INDEX) / `cloud/src/config/syncTables.ts` の `VERSIONED_TABLES` + `PRIMARY_KEYS` に `sidebar_links` 追加
  - **Frontend types & DataService**: `frontend/src/types/sidebarLink.ts` 新規 (SidebarLink / SidebarLinkKind / SidebarLinkUpdate / BrowserInfo / InstalledApp) / `frontend/src/services/DataService.ts` interface に 9 メソッド追加 (fetchSidebarLinks / createSidebarLink / updateSidebarLink / deleteSidebarLink / reorderSidebarLinks / listBrowsers / listApplications / systemOpenUrl / systemOpenApp) / `frontend/src/services/TauriDataService.ts` に invoke ブリッジ実装
  - **Frontend Context (Pattern A)**: `frontend/src/hooks/useSidebarLinks.ts` 新規 (DB-backed hook + browser preference 管理 + optimistic UI で createLink/updateLink/deleteLink/reorderLinks をロールバック付き実装、saved browser id が未インストール時に `null` fallback、setDefaultBrowserId は `defaultBrowser` キーに setAppSetting/removeAppSetting 経由永続化) / `SidebarLinksContextValue.ts` (createContext + UseSidebarLinksValue 型 alias) / `SidebarLinksContext.tsx` (Provider) / `useSidebarLinksContext.ts` (createContextHook) / `context/index.ts` に 3 export 追加
  - **Components**: `frontend/src/components/Layout/SidebarLinkItem.tsx` 新規 (emoji or fallback Globe/AppWindow icon + name truncate + ホバー時 `⋯` 右クリックメニュー (edit/delete) + disabled prop で iOS グレーアウト対応) / `SidebarLinkAddDialog.tsx` 新規 (kind トグル + name input + URL/App 切替で動的 input、App モード時のみ `listApplications` を遅延 fetch + 検索フィルタ + 選択時に target+name 自動補完、emoji input 4 文字制限、createPortal で modal 描画) / `LeftSidebar.tsx` 統合 (mainMenuItems の下に「Links」セクション + ホバー時 `+` ボタン、空時は「No links yet」placeholder、dialog state は `mode='closed'|'add'|'edit'` で管理)
  - **Settings**: `frontend/src/components/Settings/BrowserSettings.tsx` 新規 (検出ブラウザのみラジオ表示、「System default」も選択肢として並列、未検出時は説明 message のみ) / `SystemSettings.tsx` の Tray の下に `<BrowserSettings />` を組み込み
  - **Mobile**: `frontend/src/MobileApp.tsx` の `MobileLeftDrawer` 直下に常時セクション追加 (`sidebarLinks.length > 0` の条件付き)、`SidebarLinkItem` を再利用 (`disabled={link.kind === 'app'}` で App はグレーアウト)、URL クリック時は `openLink` → `setDrawerOpen(false)`、App クリック時は Toast「iOS では起動できません」、edit/delete もデスクトップ案内の Toast を表示
  - **Provider 階層**: `DesktopProviders` の `ShortcutConfigProvider` 内側に `SidebarLinksProvider` / `MobileProviders` の `WikiTagProvider` 内側に `SidebarLinksProvider` / `test/renderWithProviders.tsx` の `ShortcutConfigProvider` 内側にも追加 (Vitest が Provider を要求するため)
  - **i18n**: `ja.json` / `en.json` 両方に `sidebarLinks.*` (sectionTitle / add / addTitle / editTitle / empty / kindLabel / kindUrl / kindApp / nameLabel / namePlaceholderUrl / namePlaceholderApp / urlLabel / appLabel / appSearchPlaceholder / appNoResults / emojiLabel / itemMenu / iosAppUnsupported / editOnDesktop) 19 keys + `settings.browser.*` (title / description / systemDefault / none) 4 keys を追加
  - **CLAUDE.md 更新**: §2 機能差分表の Mobile 省略 Provider 行を「Audio / ScreenLock / FileExplorer / CalendarTags / ShortcutConfig（WikiTag / SidebarLinks は Mobile でも有効）」に修正 (旧記述では WikiTag が省略扱いだったが実コードと不整合) / §4.1 直近 migration 行に `V67(sidebar_links 新規)` 追記 + 現行 v66 → v67 / §4.1 Cloud D1 専用行に `2026-04-25 適用 migration 0004 で V65 に追従` + `2026-04-25 適用 migration 0005 で V67 に追従` を追加 / §6.2 Provider 順序を Sync 追加 + `→ SidebarLinks` を末尾に追記、Mobile 省略 Provider のリストも修正
  - **新規テスト**: `frontend/src/hooks/useSidebarLinks.test.ts` 新規 (vi.mock で DataService をスタブ、7 cases: 初期化で links/browsers/saved browser を読み込む / saved browser が未インストール時に null fallback / createLink で state 追加 / openLink('url') が systemOpenUrl を defaultBrowserId 付きで呼ぶ / openLink('app') が systemOpenApp を呼ぶ / setDefaultBrowserId(null) で removeAppSetting / deleteLink がエラー時にロールバック)
- **計画書 archive**: `.claude/2026-04-25-sidebar-tags-free-pomodoro.md` の Status を `COMPLETED 2026-04-25 (Phase A/B/C/D all done)` に更新、Phase D 全 18 step を `[x]` チェック、Status Updates に Phase A 残 + Phase D 完了行を追記してから `.claude/archive/` へ移動
- **Verification**: `cd src-tauri && cargo test` 19 passed / 1 ignored / 0 failed (新規 v67_creates_sidebar_links_table + 5 sidebar_link_repository test 含む) / `cd frontend && npx vitest run` 264 passed / 0 failed (32 test files) / `cd frontend && npx tsc -b` 0 error / `cd cloud && npx tsc --noEmit` 0 error / `cd src-tauri && cargo check` clean / `npm run lint` 変更ファイル 0 error
- **Rollout 順序 (重要)**: D1 migration を Worker deploy より先に適用すること。逆順だと旧 schema に新 Worker が当たり sidebar_links / calendar_tag_assignments delta が 500。`cd cloud && npx wrangler d1 execute life-editor-sync --remote --file=./db/migrations/0004_calendar_tags_v65.sql` → `--file=./db/migrations/0005_sidebar_links.sql` → `npm run deploy`

#### 残課題

- **deploy & 手動 UI 検証**: 上記 Rollout 順序の実行 / Desktop で V67 自動 apply 確認 / LeftSidebar の Links セクション表示 + `+` で URL/App リンク追加 + 既定ブラウザ切替で起動先が変わる / `/Applications/*.app` 一覧から登録できる / iOS Drawer で `kind='app'` がグレーアウト + Toast 出る / Desktop ↔ iOS 双方向 sync で sidebar_links / calendar_tag_assignments が伝搬する
- **計画書アーカイブ済**: archive/2026-04-25-sidebar-tags-free-pomodoro.md

---

### 2026-04-25 - sync_engine V65 follow-up fix（calendar_tag_assignments delta query を新スキーマ対応）

#### 概要

/session-verifier Gate 3 で `sync::sync_engine::tests::collect_local_changes_*` 2 件の失敗を発見。Q2 patch (1847e4c) の V65 migration が `calendar_tag_assignments` を `(entity_type, entity_id, tag_id)` + 自身の `updated_at` 持ちに再構築したが、Desktop の `sync_engine.rs::collect_local_changes` が旧スキーマ前提の `cta.schedule_item_id` JOIN を保持していたため `no such column` で sync が破綻していた。CTA 自身の `updated_at` を delta cursor とする query に書き換え（task-typed CTA も同時に拾えるよう JOIN 撤去）。`cargo test --lib` 11/13 → 13/13 pass。1 commit (`58609b3`)。

#### 変更点

- **`src-tauri/src/sync/sync_engine.rs::collect_local_changes`**: 旧 `SELECT cta.* FROM calendar_tag_assignments cta INNER JOIN schedule_items si ON cta.schedule_item_id = si.id WHERE datetime(si.updated_at) > datetime(?1)` を `SELECT * FROM calendar_tag_assignments WHERE datetime(updated_at) > datetime(?1)` に置換。V65 で CTA に `updated_at` カラムが追加され、毎 INSERT/UPDATE で stamp されるため、parent JOIN 経由で間接的に delta を判定する必要がなくなった。さらに V65 では CTA が `entity_type IN ('task','schedule_item')` を取るため、schedule_items への JOIN だけでは task-typed CTA を拾えない問題も同時に解消
- **意図コメント追加**: 「CTA has its own updated_at (V65 rebuild), so delta against the CTA row itself rather than its parent. The CTA may belong to either a schedule_item or a task (entity_type), and a JOIN-based query can no longer key off a single parent table.」を query 直前に明記
- **Verification**: `cargo test --lib sync::sync_engine` 2/2 passed（before: 0/2 with `no such column: cta.schedule_item_id`） / 全体 lib test 13 passed; 1 ignored / 0 failed

#### 残課題

- **Cloud 側の同種修正**: `cloud/src/config/syncTables.ts:97-100` も同じ stale `schedule_item_id` JOIN を持ち（`{ table: "calendar_tag_assignments", parent: "schedule_items", fk: "schedule_item_id", parentPk: "id" }`）、CalendarTags Cloud Sync (D1 migration 0004) 着地時に併修必要。MEMORY.md「Q2 機能パッチ Phase A 残 — CalendarTags Cloud Sync」に組み込み済み

---

### 2026-04-25 - リファクタリング Phase 2-1 migrations.rs 6 ファイル分割完了 + テスト復活

#### 概要

`src-tauri/src/db/migrations.rs` 2431 行のモノリシックファイルを `migrations/` ディレクトリ配下 6 ファイルに分割。`mod.rs` を orchestrator とし、`full_schema.rs`（V60 final state）/ `util.rs`（exec_ignore / has_column / has_table）/ `v2_v30.rs` / `v31_v60.rs` / `v61_plus.rs` の 5 サブモジュールに責務分離。各 SQL ブロックは byte-identical で公開 API 不変。副次改善として `LATEST_USER_VERSION = 66` 定数を導入し Q2 patch (V65/V66 追加) で陳腐化していた `assert_eq!(user_version, 64)` 5 箇所のハードコードを置換、`cargo test --lib db::migrations` を 2/7 → **7/7 pass** に復活。1 commit (`e36845b`)。`cargo check --lib` clean / `+2500/-2431 行`。

#### 変更点

- **`src-tauri/src/db/migrations.rs` 削除** (-2431 行)
- **`migrations/mod.rs` 新設** (341 行) — `pub fn run_migrations` orchestrator + `fn run_incremental_migrations` で各バージョンレンジモジュールへ dispatch + 末尾の defensive backfill (schedule_items.template_id / routine_groups.version) を保持。`use util::{exec_ignore, has_column}` で helpers を import、`#[cfg(test)] mod tests` に既存 7 tests を保持し `LATEST_USER_VERSION` 定数を追加
- **`migrations/full_schema.rs` 新設** (592 行) — `pub(super) fn create_full_schema(conn) -> rusqlite::Result<()>` で V60 final state の `CREATE TABLE IF NOT EXISTS` バッチを保持。フレッシュ DB（user_version=0）がブートストラップ時に呼ばれ、その後 user_version=61 へジャンプ
- **`migrations/util.rs` 新設** (32 行) — `exec_ignore` / `has_column` / `has_table` を `pub(super)` で集約。各バージョンモジュールから `super::util::*` で参照可能
- **`migrations/v2_v30.rs` 新設** (688 行) — V2-V30 の `if current_version < N { ... }` ブロック群を `pub(super) fn apply(conn, current_version)` でラップ
- **`migrations/v31_v60.rs` 新設** (536 行) — 同 V31-V60
- **`migrations/v61_plus.rs` 新設** (311 行) — 同 V61-V66（live frontier、新 migration はここに append）。V64 memos→dailies migration が `has_table` を使用するため import に追加
- **副次改善: テスト assertion の定数化**: `tests` モジュール先頭に `const LATEST_USER_VERSION: i32 = 66;` を追加し、5 箇所の `assert_eq!(user_version, 64)` を `LATEST_USER_VERSION` 経由に置換。これにより Q2 patch (`1847e4c`) で V65 / V66 追加時に更新漏れていた 5 件のテスト失敗（fresh_db_reaches_latest / v60_db_upgrades_to_v61 / v59_db_upgrades_to_v60 / v62_migration_is_idempotent / v64_renames_memos）を解消。今後の migration 追加時はこの定数だけ bump すればよい
- **Verification**: `cd src-tauri && cargo check --lib` exit 0 / `cargo test --lib db::migrations` **7/7 passed** (was 2/7 on baseline before this commit) / 各 SQL ブロックの byte-identity は git diff で確認

#### 残課題

- **Phase 2-2 TauriDataService.ts 分割**: 1481 行 / 257 メソッドの class を `services/data/{tasks,timer,notes,daily,schedule,wikitags,...}.ts` に分割。class → composition pattern (object spread) の設計判断 + `dataServiceFactory.ts` の `new TauriDataService()` 経由参照箇所への影響評価が必要
- **Phase 2-3b/c/d 巨大コンポーネント残**: ScheduleTimeGrid (1220) / OneDaySchedule (1165) / TagGraphView (1443) — 1 セッション 1 ファイル + 手動 UI 検証
- **Phase 2-4 Calendar Mobile-Desktop 統合**: `useCalendarViewLogic` + `components/Calendar/shared/` 新設

---

### 2026-04-25 - Q2 機能パッチ Phase A/B/C 実装（CalendarTags 1:1+Task / Pomodoro Free / WikiTag 未登録 + Events ソート）

#### 概要

ユーザー要件 4 件のうち 3 件 (CalendarTags 単数化 + Task 対応 + Schedule rightSidebar UI / Pomodoro Free モード + 保存ダイアログ / WikiTag 未登録フィルタ + Events リスト排他的ソート) を 1 セッションで実装。Phase D (Sidebar Links + Browser/App 起動) と Phase A の Cloud Sync は次セッション以降。tsc -b clean / Vitest 257/257 / 変更ファイル lint clean / cargo check pass。28 modified + 6 new files。**過去ドキュメントの誤記修正**として `tier-1-core.md` / `tier-2-supporting.md` から「Tasks に WikiTag 付与可」という記述を削除し、「Tasks は CalendarTags 担当 / WikiTags 対象外（RichTextEditor 非搭載）」を明記。計画書: `.claude/2026-04-25-sidebar-tags-free-pomodoro.md`（Phase A/B/C COMPLETED, Phase D PENDING）。

#### 変更点

- **Phase A — CalendarTags 1:1 + Task 対応**:
  - **DB V65**: `calendar_tag_assignments` を `(id PK, entity_type CHECK in 'task'|'schedule_item', entity_id, tag_id)` + `UNIQUE(entity_type, entity_id)` で再構築。旧複合 PK の multi-tag は `MIN(tag_id)` で 1:1 に collapse。`calendar_tag_definitions` に `created_at / updated_at / version / is_deleted / deleted_at` カラム追加（Cloud Sync 用）
  - **Rust**: `calendar_tag_repository::set_tag_for_entity(entity_type, entity_id, Option<i64>)` を新規追加 / 旧 `set_tags_for_schedule_item` は後方互換 shim として `MIN(tag_ids)` で `set_tag_for_entity` 呼び出しに統一 / `delete` は soft delete + cascade clear 対応 / 親エンティティの `updated_at + version` を bump して Cloud Sync delta が拾えるよう保証
  - **IPC**: 新規コマンド `db_calendar_tags_set_tag_for_entity` を `lib.rs` に登録 + DataService interface に `setTagForEntity(entityType, entityId, tagId | null)` + `fetchAllCalendarTagAssignments` の戻り値を `{entityType, entityId, tagId}` 形式に変更
  - **Frontend**: `useCalendarTagAssignments` を `Map<entityKey, number>` 1:1 化（後方互換 shim 維持）/ `useCalendarTagFilter` 新規（`number | "untagged" | null` を localStorage `calendarTagFilter` に永続化）/ `CalendarTagsContext` に filter state を統合 / `CalendarTagsPanel.tsx` 新規（タグ管理 + 色変更 + 削除 + 「すべて」「未登録」フィルタチップ） / `CalendarTagSelector.tsx` 新規（単一選択 dropdown） / `ScheduleSidebarContent.tsx` で `CalendarTagsPanel` を全 4 タブ常時表示に / `ScheduleItemEditPopup.tsx` の event/task 詳細にタグセレクター追加 / `useCalendarTagsContextOptional` で Provider 外でも null 安全
- **Phase B — Pomodoro Free モード + 保存ダイアログ**:
  - **DB V66**: `timer_sessions` に `label TEXT` カラム追加
  - **Rust**: `end_session_with_label` repository fn + `db_timer_end_session_with_label` IPC コマンド追加 / `lib.rs` に handler 登録
  - **TimerContext**: SessionType に `"FREE"` 追加 / `timerReducer` に `START_FREE` action + FREE モード TICK +1 (count up) / `pause` で FREE 時は `pendingFreeSave: { sessionId, elapsedSeconds }` を state にセット / `startFreeSession` / `saveFreeSession({label, role, parentTaskId, calendarTagId})` / `discardFreeSession` を Context に追加。Task 保存時は `createTask({status: 'DONE', parentId, completedAt, workDurationMinutes})` で完了済タスクとして TaskTree に挿入、Event 保存時は `createScheduleItem(routineId=null)` + `setTagForEntity` で完了済イベントを Calendar に挿入
  - **Frontend**: `FreeSessionSaveDialog.tsx` 新規（label 入力 / Role=Task → TaskTree autocomplete 検索 / Role=Event → CalendarTagSelector / 「次回から表示しない」localStorage 永続化）/ `WorkScreen.tsx` に「Free セッション開始」ボタン追加 + `pendingFreeSave` 監視で SaveDialog 自動表示 + `freeSessionSaveDialogEnabled === false` 時の auto-discard / `TimerSettings.tsx` に「Pomodoro 有効/無効」「保存ダイアログ表示」トグル / `pomodoroSettings.ts` 新規（react-refresh の `only-export-components` 制約回避で 4 つの localStorage 関数を分離）
- **Phase C — WikiTag 未登録 + Events ソート**:
  - **TagFilterOverlay**: `UNTAGGED_FILTER_ID = "__untagged__"` sentinel + `showUntaggedOption` prop 追加。tags モード時に「(Untagged)」エントリを最上部に表示
  - **DailySidebar / MaterialsSidebar**: `tagFilteredMemos` / `tagFilteredNotes` で `UNTAGGED_FILTER_ID` 選択時はタグ assign 0 件のみ抽出する分岐を追加 / 各 TagFilterOverlay 呼び出しに `showUntaggedOption` prop を付与
  - **EventList**: 全面再実装で排他的ソート 4 軸（`date-desc / date-asc / title-asc / tag`）を localStorage `eventsListSort` に永続化 / `tag` モードでは CalendarTag.order 順でグルーピング表示 + 末尾に Untagged バケツ / CalendarTag フィルタ連動（`activeFilterTagId`: number → 該当タグ / "untagged" → 未登録のみ） / 行内に CalendarTag のドット表示
- **過去ドキュメント修正**:
  - `tier-1-core.md` Tasks セクションから V60 で撤去済の `task_tags / task_tag_definitions` 言及を削除 + 他機能連携の `WikiTags（タグ付与・検索）` を `CalendarTags（単一タグ付与・フィルタ）` に置換 + 「**WikiTags は対象外**（Task は RichTextEditor を持たないため UI 経由のタグ付与経路がない）」を明記 / Cloud Sync 未対応テーブル一覧から `task_tags` を削除
  - `tier-2-supporting.md` WikiTags Purpose / Boundary / AC1 / Dependencies から Tasks を除外し、「タグ管理は CalendarTags が担当」を明記
- **新規ファイル**: `frontend/src/components/Schedule/CalendarTagsPanel.tsx` / `CalendarTagSelector.tsx` / `frontend/src/components/Work/FreeSessionSaveDialog.tsx` / `frontend/src/hooks/useCalendarTagFilter.ts` / `frontend/src/utils/pomodoroSettings.ts` / `.claude/2026-04-25-sidebar-tags-free-pomodoro.md`（実装プラン、Phase A/B/C 完了 / Phase D 未着手で IN_PROGRESS）
- **Verification**: `cd frontend && npx tsc -b` 0 errors / `npm run test` 257/257 passed（CalendarTagsPanel / EventList の Optional Provider 化により従来テストが Provider なしでも動作） / `cd src-tauri && cargo check` 通過 / 変更 22 ファイル + 新規 5 コードファイル + 1 プランファイル に対する eslint clean
- **session-verifier で発見・修正したパターン**:
  - `react-refresh/only-export-components` 違反 → `pomodoroSettings.ts` への関数 export 分離で解消
  - `react-hooks/set-state-in-effect` 違反 → `useState(() => ...)` 初期化に置換 / 不要な `useEffect(() => setName(tag.name))` の削除
  - 未使用 `useEffect` import / `react-hooks/refs` ルール対応

#### 残課題

- **Phase D — Sidebar Links**: V67 migration / `sidebar_links` table / system_commands (browser detect / app launch / /Applications enumerate) / LeftSidebar UI（Analytics と Settings の間に表示） / Add Dialog（URL or App 選択 + 絵文字） / Settings ブラウザ選択 / Mobile Drawer 統合（`kind='app'` はグレーアウト） / Cloud Sync (D1 0005)
- **Phase A 残 — CalendarTags Cloud Sync**: `cloud/db/migrations/0004_calendar_tags.sql` + Workers VERSIONED_TABLES / RELATION_TABLES_WITH_UPDATED_AT 追加 / Desktop ↔ iOS 双方向同期検証
- **手動 UI 確認**: `cargo tauri dev` で Schedule rightSidebar に「Tags」パネル表示 / Event/Task 詳細で 1:1 タグ選択 / Free セッション開始 → 停止 → SaveDialog 表示 → Task または Event として保存 → TaskTree / Calendar に出現を確認
- **i18n**: 新規 UI テキストは `t("...", "fallback")` の fallback 付きで動作するが、`ja.json` / `en.json` への明示的キー追加は別タスクで実施

---

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

### 2026-04-23 - Memos → Daily 全層 rename + MemoEditor → RichTextEditor 中立分離（計画書: archive/2026-04-22-memos-to-daily-rename.md）

#### 概要

Materials 上部タブ「Daily」の実体が UI 上は既に "Daily" だが内部実装は全て `memos` 語彙（DB テーブル / IPC / MCP ツール / TypeScript context / Cloud Sync tableName / i18n）という命名分裂を根絶。DB v63→v64 migration で `memos` → `dailies` テーブル rename（`memo-YYYY-MM-DD` → `daily-YYYY-MM-DD` の id 形式変換、`note_links.source_memo_date` → `source_daily_date` カラム rename、`wiki_tag_assignments` / `paper_nodes` の `entity_type='memo'` → `'daily'` 値更新）を含む全 7 レイヤー横断リネーム + MemoEditor TipTap エディタ（589 行）を Task / Note / Template / Daily / Mobile 5 箇所で使われる汎用エディタとして `components/shared/RichTextEditor.tsx` に中立命名で再配置。MCP ツール `get_memo` / `upsert_memo` → `get_daily` / `upsert_daily` は N=1 ユーザー方針で互換期間なしの Hard break。`time_memos` テーブルは別概念のため意図的に除外。検証: cargo test 11/11（V64 migration data 変換テスト新規）/ cargo build --release 成功 / Vitest 231 pass / Frontend build + MCP build 成功。

#### 変更点

- **DB Migration V64（`src-tauri/src/db/migrations.rs`）**: V64 ブロック追加。(1) `dailies` テーブルを `memos` と同一スキーマで作成 (2) `INSERT INTO dailies SELECT 'daily-' \|\| substr(id, 6), ... FROM memos` で id 形式変換付きデータコピー (3) `ALTER TABLE note_links RENAME COLUMN source_memo_date TO source_daily_date`（SQLite 3.25+ 依存、rusqlite bundled で OK）(4) `UPDATE wiki_tag_assignments SET entity_type='daily', entity_id='daily-' \|\| substr(entity_id, 6) WHERE entity_type='memo'` (5) `UPDATE paper_nodes` 同様 (6) `DROP TABLE memos` (7) index 再構築 `idx_dailies_date` / `idx_dailies_deleted` / `idx_dailies_updated_at` / `idx_note_links_source_daily`。`has_table()` ヘルパ新設（`sqlite_master` 参照）。過去の migration（V21/V26/V36/V51/V54/V62）は `memos` 名称のまま残置（fresh install → full_schema + 段階 migration が memos を経由してから V64 で rename するチェーン維持）。`create_full_schema` 内の memos テーブル定義・index 定義は未修正。V64 migration test 1 件追加: pre-V64 schema で memos / note_links / wiki_tag_assignments をシード → run_migrations → dailies 存在 / memos 不在 / id 形式変換 / version/is_pinned 保持 / column rename / entity_type 書き換え / user_version=64 を全件検証
- **Rust Backend**: `src-tauri/src/db/memo_repository.rs` → `daily_repository.rs` rename（`MemoNode` → `DailyNode`, `row_to_memo` → `row_to_daily`, SQL `FROM memos` → `FROM dailies`, `format!("memo-{}", date)` → `format!("daily-{}", date)`, `helpers::soft_delete_by_key(..., "memos", ...)` → `"dailies"`）/ `src-tauri/src/commands/memo_commands.rs` → `daily_commands.rs` rename（12 IPC: `db_memo_fetch_all` → `db_daily_fetch_all` 他、`memo_repository::` → `daily_repository::` import 差し替え）/ `lib.rs` の `generate_handler!` で 12 handler 登録を `commands::daily_commands::db_daily_*` に置換 / `src-tauri/src/sync/sync_engine.rs`: `VERSIONED_TABLES` の `("memos", "id")` → `("dailies", "id")`、`collect_local_changes` / `get_payload_field` / `set_payload_field` で `"memos"` / `payload.memos` → `"dailies"` / `payload.dailies` / `src-tauri/src/sync/types.rs::SyncPayload` の `memos: Vec<Value>` → `dailies` / `src-tauri/src/db/note_link_repository.rs` の `source_memo_date` カラム参照 → `source_daily_date`、`upsert_links_for_memo` → `upsert_links_for_daily` / `src-tauri/src/commands/note_link_commands.rs::db_note_links_upsert_for_memo` → `..._for_daily` + param `source_memo_date` → `source_daily_date` / `copy_commands::copy_memo_to_file` → `copy_daily_to_file` / `diagnostics_commands` / `data_io_commands`（export/import JSON キー + DELETE FROM 文字列）/ `claude_commands` の CLAUDE*MD prompt 内ツール名を `get_daily` / `upsert_daily` に更新。`db/mod.rs` / `commands/mod.rs` の `pub mod` 宣言も更新。`time_memo*\*` 関連は touch せず（別概念ガード）
- **MCP Server**: `mcp-server/src/handlers/memoHandlers.ts` → `dailyHandlers.ts` rename（`MemoRow` → `DailyRow`, `getMemo` / `upsertMemo` → `getDaily` / `upsertDaily`, `formatMemo` → `formatDaily`, SQL `FROM memos` → `FROM dailies`, `memo-${date}` → `daily-${date}`）/ `tools.ts`: ツール名 `get_memo` / `upsert_memo` → `get_daily` / `upsert_daily` の Hard break（互換 alias なし）、switch case / import / description 全更新、`search_all` の domain enum / `tag_entity` / `search_by_tag` / `get_entity_tags` の entity_type enum / `generate_content` / `format_content` の target enum を `"memo"` → `"daily"` に / `contentHandlers.ts`: `target: "memo" | ...` → `"daily" | ...`、`memo-${date}` → `daily-${date}`, SQL 全文 / `searchHandlers.ts`: `VALID_DOMAINS` の `"memos"` → `"dailies"`, `MemoRow` → `DailyRow`, result key `memos` → `dailies` / `wikiTagHandlers.ts`: `entity_type === "memo"` → `"daily"` + SELECT `FROM memos` → `FROM dailies`
- **Frontend 型 + Context/Hook (Pattern A)**: `types/memo.ts` → `types/daily.ts`（`MemoNode` → `DailyNode`, id コメント `"memo-YYYY-MM-DD"` → `"daily-YYYY-MM-DD"`）/ `context/MemoContextValue.ts` → `DailyContextValue.ts`（3-file 分割継続）/ `context/MemoContext.tsx` → `DailyContext.tsx`（`MemoProvider` → `DailyProvider`, `memoState` → `dailyState`）/ `hooks/useMemoContext.ts` → `useDailyContext.ts` / `hooks/useMemos.ts` → `useDaily.ts`（state `memos` / `deletedMemos` → `dailies` / `deletedDailies`, 全 callback `upsertMemo` / `deleteMemo` / `restoreMemo` / `permanentDeleteMemo` / `togglePin` / `setMemoPassword` / `removeMemoPassword` / `verifyMemoPassword` / `toggleEditLock` / `getMemoForDate` / `selectedMemo` / `loadDeletedMemos` / `useMemos` → `useDaily` 含む全面 rename、undo domain `"memo"` → `"daily"`）/ `context/index.ts` / `types/index.ts` exports 更新。`UndoDomain` enum の `"memo"` → `"daily"`（`utils/undoRedo/types.ts`）、`TitleBar.tsx` の `SECTION_UNDO_DOMAINS.materials` 更新、`ConversionSource.memo: DailyNode` → `daily: DailyNode`（`useRoleConversion.ts` + 4 consumer）、`WikiTagEntityType` を `"task" \| "daily" \| "note"` に、`useWikiTagSync` / `useNoteLinkSync` の型パラメータと discriminated union `kind: "memo"` → `"daily"` / `memoDate` → `dailyDate` も同期更新
- **Frontend DataService + TauriDataService**: 12 メソッド rename（`fetchAllMemos` → `fetchAllDailies`, `fetchMemoByDate` → `fetchDailyByDate`, `upsertMemo` → `upsertDaily`, `deleteMemo` → `deleteDaily`, `fetchDeletedMemos` → `fetchDeletedDailies`, `restoreMemo` / `permanentDeleteMemo` / `toggleMemoPin` / `setMemoPassword` / `removeMemoPassword` / `verifyMemoPassword` / `toggleMemoEditLock`）+ `upsertNoteLinksForMemo(sourceMemoDate, ...)` → `upsertNoteLinksForDaily(sourceDailyDate, ...)` + `copyMemoToFile(memoDate, ...)` → `copyDailyToFile(dailyDate, ...)`。`TauriDataService.ts` の invoke 対象 IPC 名 `db_memo_*` → `db_daily_*` / `db_note_links_upsert_for_memo` → `..._for_daily` / `copy_memo_to_file` → `copy_daily_to_file`。`test/mockDataService.ts` も全 mock を新名に
- **Frontend コンポーネント自動置換**: 32 consumer ファイルに perl ワンライナーで `MemoContext` / `useMemoContext` / `MemoNode` / `useMemos` / `MemoProvider` / `MemoContextValue` / 12 DataService メソッド名 / `memos` state / `deletedMemos` / `selectedMemo` 等を word-boundary 付き一括 rename。二次 rename で `MemoActivityHeatmap` / `MemoActivityCell` / `aggregateMemoActivity` / `MemoNodeComponent` / `MemoNodeInner` / `memoNode` / `MemoMonthGroup` / `groupMemosByMonth` / `memoGrouping` / `memoTagMap` / `visibleMemoIds` / `activeMemos` / `memoExists` / `memoCount` も処理。File rename: `components/Ideas/DailyMemoView.tsx` → `DailyView.tsx` / `components/Mobile/MobileMemoView.tsx` → `MobileDailyView.tsx` / `components/Analytics/MemoActivityHeatmap.tsx` → `DailyActivityHeatmap.tsx` / `components/Ideas/Connect/MemoNodeComponent.tsx` → `DailyNodeComponent.tsx` / `utils/memoGrouping.ts` → `dailyGrouping.ts`。残存 `memoId` / `memoDate` / `memoDateSet` / `onDeleteMemoEntity` / `DailyNodeComponent.tsx` 内部 `MemoNodeType` も個別対応。`MobileMaterialsView.tsx` のタブ ID `"memos"` → `"daily"`、`McpToolsList.tsx` の表示 tool 名 `get_memo` / `upsert_memo` → `get_daily` / `upsert_daily`
- **MemoEditor → RichTextEditor 中立分離**: `components/Tasks/TaskDetail/MemoEditor.tsx`（589 行 TipTap ラッパー）→ `components/shared/RichTextEditor.tsx` へ移動 + 名前変更（Task / Note / Template / Daily / Mobile の 5 箇所で汎用的に使われるエディタと判明したため、ドメイン中立名で `shared/` に配置）/ `LazyMemoEditor.ts` → `LazyRichTextEditor.ts` / 6 consumers（`TaskDetail.tsx` / `DailyView.tsx` / `NotesView.tsx` / `TemplateContentView.tsx` / `MobileNoteView.tsx` / `MobileDailyView.tsx`）の import path を新階層に合わせて 2 levels に調整、`<MemoEditor>` JSX → `<RichTextEditor>`。内部 import（3 levels → 2 levels）、`./BubbleToolbar` / `./BlockContextMenu` → `../Tasks/TaskDetail/...` に修正（BubbleToolbar/BlockContextMenu は TaskDetail に残置）。`entityType="memo"` → `entityType="daily"` を 5 箇所で更新
- **i18n**: `frontend/src/i18n/locales/en.json` / `ja.json` の `mobile.tabs.memos` → `mobile.tabs.daily`（値 "Memos"/"メモ" → "Daily"/"日記"）、`mobile.memo.*` ブロック → `mobile.daily.*` へ key rename（`today` / `empty` / `placeholder`、値も英: "No entries yet" / 日: "まだ日記がありません" に更新）。Desktop の `ideas.daily` は元から "Daily" / "日記" で変更不要
- **Cloud Sync**: `cloud/db/schema.sql` の `memos` テーブル定義と `idx_memos_*` インデックスを `dailies` / `idx_dailies_*` に更新 / `cloud/db/migrations/0002_rename_memos_to_dailies.sql` を新規作成（Desktop V64 と同等の SQL 一式: dailies 作成 + 変換 copy + note_links column rename + wiki_tag_assignments/paper_nodes の entity_type 更新 + memos DROP + index 再構築）/ `cloud/src/routes/sync.ts` の `VERSIONED_TABLES` 配列の `"memos"` → `"dailies"`、`PRIMARY_KEYS` map の `memos: "id"` → `dailies: "id"`。**運用注意**: D1 本番への migration 実行は未実施、Desktop/iOS app の V64 デプロイと協調して `wrangler d1 execute life-editor --file=cloud/db/migrations/0002_rename_memos_to_dailies.sql` が必要
- **ドキュメント**: `.claude/CLAUDE.md` の §2 Platform 機能差分マトリクス / §4.1 SQLite スキーマ（v62 → v64、V63/V64 migration 履歴追記）/ §4.2 特化テーブルリスト / §4.3 ID 戦略（DailyNode id 形式追記）/ §4.4 ソフトデリート対象 / §5.1 MCP ツール表（`Memos` → `Dailies`, `get_memo` / `upsert_memo` → `get_daily` / `upsert_daily`）/ §6.2 Provider 順序 / §8 Tier 1 機能一覧 を全面更新。`.claude/docs/vision/plans/2026-04-22-memos-to-daily-rename.md` を Status COMPLETED に更新し `.claude/archive/` へ移動。`.claude/docs/vision/plans/2026-04-22-ios-refactor.md` は未着手のため保持
- **併走: TaskTree + Folder DetailPanel 簡素化の残り変更を合流**: 前 session（2026-04-23 TaskTree）で「memos→daily 着地時に合流予定」として working tree に保留されていた `FolderMovePicker.tsx` 削除 / `TaskDetailPanel.tsx` の FolderMovePicker 参照除去 / `TaskNodeCheckbox.tsx` の icon prop 追加 / `TaskTreeNode.tsx` の Complete フォルダ展開ロジック / `storageKeys.ts` の `FOLDER_MOVE_CONFIRM_SKIP` 削除 / `McpToolsList.tsx` の domain key "memos" → "dailies" を本 commit に同梱
- **検証**: `cargo test --lib` 11 pass（V64 migration test 新規 1 件を含む）/ `cargo build --release` 成功 / `cargo check` clean / `npx vitest run` 231 pass（29 files）/ `cd frontend && npm run build` 成功（`tsc -b` + `vite build`、solution-style tsconfig で build 経由の型検証）/ `cd mcp-server && npm run build` 成功 / `cd cloud && npx tsc --noEmit` 成功 / ESLint は新規 Daily ファイル 0 error（pre-existing 116 件は別タスク）
- **残課題（別セッション）**: (a) Desktop `/Applications/Life Editor.app` を V64 対応ビルドに置換 (b) Cloud D1 本番への 0002 migration 適用 (c) iOS 実機での Daily タブ動作検証 (d) `docs/requirements/tier-1-core.md` 他副次ドキュメントの "Memo" 言及更新（cosmetic）

---

### 2026-04-23 - TaskTree + Folder DetailPanel ヘッダー簡素化（アイコン同期 / Move to folder 廃止 / Complete フォルダ展開）

#### 概要

TaskTree 行と Folder DetailPanel のヘッダー UI を 5 観点で簡素化。(1) TaskTree のフォルダ行がフォルダの `node.icon` に追従するようになり DetailPanel と完全同期、(2) Folder DetailPanel のアイコンピッカーをタイトル左横にインライン配置して独立ブロックを撤去、(3) Task DetailPanel の「Move to folder」機能と `FolderMovePicker.tsx` を完全廃止(手動 DnD で代替)、(4) パスの祖先アイコン反映は既存コードで対応済みを確認、(5) Complete フォルダ選択時に TaskTree 側で展開ドロップダウン / DetailPanel 側で DONE タスク一覧が見えるよう `activeChildren` / `children` useMemo フィルタを緩和。変更 6 ファイル / 削除 1 / Vitest 29 files 231 tests pass / `tsc -b` 私の編集ファイルにエラーなし / ESLint 6 件は react-hooks/refs の既存パターン(`git stash push -- TaskDetailPanel.tsx` で編集前同一を確認済みスコープ外)。

#### 変更点

- **TaskNodeCheckbox (`frontend/src/components/Tasks/TaskTree/TaskNodeCheckbox.tsx`)**: `icon?: string` prop を追加、`renderIcon(icon, { size: 14 })` でフォルダの `node.icon` を優先描画(未設定時は従来の `FolderOpen` / `Folder` を展開状態に応じて切替)
- **TaskTreeNode (`frontend/src/components/Tasks/TaskTree/TaskTreeNode.tsx`)**: `<TaskNodeCheckbox>` へ `icon={node.icon}` を伝搬。`activeChildren` useMemo を `isSystemFolder ? rawChildren : rawChildren.filter((c) => c.status !== "DONE" || c.folderType === "complete")` に分岐して Complete フォルダ直下の DONE タスクが `node.isExpanded` 時に表示されるよう修正。`useMemo` 依存配列に `isSystemFolder` を追加
- **TaskDetailPanel Task 側 (`frontend/src/components/Tasks/TaskDetail/TaskDetailPanel.tsx`)**: `FolderMovePicker` 使用箇所(breadcrumb 行の「Move to folder」trigger)を削除し breadcrumb 行は ancestors 表示のみに整理。不要になった import / props / callback を一括除去(`FolderMovePicker` / `FolderOpen` / `MoveResult` / `MoveRejectionReason` / `useToast` / `moveNodeInto` / `moveToRoot` / `onMoveRejected` / `handleMove`)
- **TaskDetailPanel Folder 側**: タイトル下の独立 Icon Picker ブロック(`folderIcon` ラベル付きボタン)を撤去し、タイトル行の左側にアイコンボタン(`size=20`)をインライン統合。Complete フォルダ時は `FolderCheck size={20}` を読み取り専用で表示。`children` useMemo に `node.folderType === "complete"` 分岐を追加し自身が Complete フォルダ時は DONE 子を全件含める(下流の `childTasks` フロー経由で TaskStatusIcon = DONE として表示される)
- **FolderMovePicker 削除**: `frontend/src/components/Tasks/Folder/FolderMovePicker.tsx` を削除(他参照 0 件で grep 確認)。`FolderDropdown` / `flattenFolders` は `ScheduleSidebarContent` / `TaskTreeHeader` / `FolderList` / `NewTaskTab` から引続き使用中のため維持
- **Storage Key 削除**: `FOLDER_MOVE_CONFIRM_SKIP` を `frontend/src/constants/storageKeys.ts` から除去(`FolderMovePicker` 専用だったため)
- **i18n 同期削除(working tree のみ、本コミットには含めず)**: `en.json` / `ja.json` の `taskDetailSidebar.moveToFolder` と `taskDetailSidebar.moveFolderConfirm` は working tree では削除済みだが、同じ 2 ファイルに並行進行中の memos→daily refactor の変更が entangle しているため本コミットから意図的に除外(別セッションで memos→daily 着地時に合流予定)。残った dead i18n key は runtime 影響なし。`folderIcon` は Folder DetailPanel のアイコンボタン `title` 属性(tooltip)で継続使用のため元々残置、`dontShowAgain` は `ConfirmDialog` 他で使用中
- **検証**: `npx tsc -b --force`(frontend)私の編集 4 ファイルに型エラーなし — 他 20+ 件の型エラーは並行進行中の memos→daily refactor 起因で別スコープ / `npx vitest run` 29 files / 231 tests pass / `npx eslint` 私の編集 TSX に 6 件の `react-hooks/refs` error、`git stash push -- TaskDetailPanel.tsx FolderMovePicker.tsx` で編集前 HEAD にも同 6 件存在を確認しプリ既存と判定(`ancestor.map` 内条件 ref 代入と `folderIconRef.current?.getBoundingClientRect()` のレンダー中アクセス — コードベース全体で同パターン多数、別セッションで一括対処)
- **手動テスト**: UI の実機動作確認は未実施(次セッションで iOS 実機含め実施予定)

---

### 2026-04-22 - Routine schedule_items 重複の根本修正 + Cloud sync initial-pull truncation 暫定対応（Known Issues 011 / 012）（計画書: archive/2026-04-21-routine-dup-fix.md）

#### 概要

iOS Mobile の Schedule で同一 Routine が最大 8 コピー重複表示される問題 (Known Issue 011) の根本原因を **4 層の構造的欠陥** に分解して修正: (1) `schedule_items` に `UNIQUE(routine_id, date)` 制約欠落 / (2) sync 衝突解決が `id` 単独で異 id × 同 (routine_id, date) を全 INSERT / (3) Frontend `existingByRoutineId` Map が `routineId` 単独キーで既存重複検知に失敗 / (4) Rust `schedule_item_repository::create()` に重複ガード無し(`bulk_create` と非対称)。V63 migration + create() ガード + sync_engine 特別扱い + Cloud Worker pre-dedup + 複合キー `${routineId}:${date}` + backfill existingSet で根治。Cloud D1 の既存 1,181 行を dry-run preview 付きで destructive DELETE、partial UNIQUE index `idx_si_routine_date` を SQLite/D1 両端に張り恒久化。iOS 再インストール過程で 4 件の派生トラブル(Xcode PATH / dead code IdeasView / 未使用 useEffect / Cloud Worker `/sync/changes` LIMIT=500 truncation)を解消し Known Issue 012 として LIMIT=5000 bump の暫定対応を着地。本命 fix(client pagination loop on `hasMore`)は別セッション。cargo check 0 / frontend build 11.15s / vitest 231 pass / cloud tsc 0 / eslint(session 変更範囲) 0。

#### 変更点

- **V63 migration**: `src-tauri/src/db/migrations.rs` に V63 ブロック追加。`schedule_items` の (routine_id, date) 重複を `MIN(updated_at)` 保持で idempotent DELETE + `CREATE UNIQUE INDEX IF NOT EXISTS idx_si_routine_date ON schedule_items(routine_id, date) WHERE routine_id IS NOT NULL AND is_deleted = 0` を張る。部分 UNIQUE により soft-delete 行は制約対象外となり再作成可能
- **Rust `create()` ガード**: `src-tauri/src/db/schedule_item_repository.rs` の `create()` に (routine_id, date, is_deleted=0) 存在チェックを追加し、既存行があれば新規作成せず既存を返す。`bulk_create` と対称な契約に。`bulk_create` の exists 検査にも `is_deleted=0` 条件を追加し、soft-delete 後の再作成を可能に
- **sync_engine 特別扱い**: `src-tauri/src/sync/sync_engine.rs::upsert_versioned` で `schedule_items` を分岐し、異なる id × 同 (routine_id, date) が既存なら push 時に skip。id 単独の LWW を複合キー対応に拡張
- **Cloud Worker pre-dedup**: `cloud/src/routes/sync.ts::/sync/push` で schedule_items routine 行を push 時に (routine_id, date) で既存 canonical id を参照し、incoming id が不一致なら drop。異端末からの重複 push を D1 への書き込み前に弾く
- **Cloud schema 整合**: `cloud/db/schema.sql` に同 UNIQUE index を追加(新規プロビジョン時のため)
- **Frontend 複合キー**: `frontend/src/utils/routineScheduleSync.ts` の `existingByRoutineId` Map を `existingByKey = new Map<string, ScheduleItem>()` に変更、キーは `${routineId}:${date}`。`collectRoutineItemsForDates` の `existingSet` 引数も同じ複合キー形式に
- **Frontend backfill 堅牢化**: `frontend/src/hooks/useScheduleItemsRoutineSync.ts::backfillMissedRoutineItems` に `existingSet` build 処理を追加(従来は渡さず `collectRoutineItemsForDates` が既存を参照できなかった)。`ensureRoutineItemsForWeek` / `ensureRoutineItemsForDateRange` と対称化
- **Cloud D1 運用クリーンアップ**: wrangler から destructive 作業を段階実行 — dry-run SELECT で to_delete=1,181(事前診断と +1 誤差) → DELETE 実行(duration 93ms) → UNIQUE index 作成 → 検証 SELECT で重複 0 確認。total 1,937 → 756 / active 1,936 → 755 で Desktop SQLite と完全一致
- **Cloud Worker デプロイ**: `wrangler deploy` 2 回(pre-dedup 初回 `df98e207-...` + LIMIT bump 二回目 `5b967394-...`)
- **Known Issue 012 発見 + 暫定対応**: iOS fresh install の `/sync/changes` 初回 pull が LIMIT=500 per table で打ち切られ、`updated_at > 2026-04-11 07:58:44` の 296 行(4/14〜4/22 の routine / notes / memos 編集)が欠落していた。原因は (a) Worker が `hasMore: true` を返すが cursor 無し / (b) Rust client `types.rs:50::has_more` field は定義されるが参照箇所 0 件 = 無視。暫定で LIMIT 500 → 5000 に bump(現行データ量でカバー可)、本命 fix(cursor + client loop)は Known Issue 012 として起票
- **孤児コード削除**: `frontend/src/components/Ideas/IdeasView.tsx` を削除。commit `82ef226` で `ConnectView` に置換された際に旧ファイルが残置されており、`TagGraphView` interface 拡張で tsc -b が落ちていた(Xcode 実機 build が落ちて初めて露見)
- **MobileNoteView 未使用 import 除去**: `frontend/src/components/Mobile/MobileNoteView.tsx` から `useEffect` を import から削除。noUnusedLocals の TS6133 エラーが iOS build を阻害していた
- **ドキュメント整備**: `.claude/docs/known-issues/011-schedule-items-routine-date-duplication.md` + `012-sync-changes-limit-500-truncates-large-initial-pull.md` 新規、INDEX.md 更新。`.claude/docs/vision/realtime-sync.md` 新規(Phase 1: foreground 可変 polling + mutation-triggered push / Phase 2: CF Durable Objects WebSocket の 2 段階構想)
- **計画書完了 + archive**: `.claude/2026-04-21-routine-dup-fix.md` を Status `COMPLETED` に更新し `.claude/archive/` へ移動
- **未コミット refactor の stash 退避**: iOS build を通すため、作業開始時点で未コミットだった Memo→Daily rename(types/memo.ts → daily.ts 他 30+ ファイル) + Mobile parity + 009/010 known-issues docs を `git stash push -u -m "WIP: Memo->Daily refactor + Mobile parity + known-issues 009/010 (paused for iOS routine-dup verify on 2026-04-22)"` で退避。iOS 検証優先のため本 session では unstash 見送り、次 session で再開
- **システム状態変更**: Xcode GUI 起動時に NVM 管理の `/Users/newlife/.cargo/bin/cargo` が PATH に無い問題を `/usr/local/bin/{cargo,rustc,rustup}` の sudo symlink で解消(ユーザー手動実行、git 外の永続変更)
- **iOS 端末手順**: Developer Mode ON + VPN とデバイス管理でプロファイル信頼 + Xcode Devices and Simulators から `.ipa` 手動インストール(`cargo tauri build` は install しない仕様のため)+ iOS Settings > Cloud Sync で URL/Token 設定 → Disconnect/Reconnect で since=1970 強制 → LIMIT=5000 Worker から 796+ rows pull。4/14-4/22 の routine 表示復活を確認
- **検証**: `cargo check` 0 / `npm run build`(frontend) ✓ built in 11.15s / `npm run test`(vitest) 231 pass / `npx tsc --noEmit`(cloud) 0 / ESLint session 変更範囲 0(既存 116 problems は scope 外の技術債)
- **派生して発見した脆弱性(詳細は MEMORY.md §バグの温床)**: 論理一意性を持つ他テーブルの UNIQUE 制約欠落 / sync 衝突解決 id 単独設計の他テーブル波及 / pagination 半実装(5000 で逃げても成長で再発) / client/server 分散 flag(`hasMore`) の扱い / Mobile UI の Full Re-sync ボタン不在 / `tsc --noEmit` at frontend root が solution-style tsconfig で無意味 / Xcode GUI ⌘R が Tauri 2.x で動かない / Desktop パッケージ版と HEAD 実装の乖離

---

---

### 2026-04-21 - Notes Mobile/Desktop エディタ統合 Phase A（`MemoEditor` 共有 + レスポンシブ対応）

#### 概要

Materials Notes で Desktop と iOS の表示が食い違う問題の根本対策として、Mobile 専用の TipTap エディタ（`MobileRichEditor`）を廃止し、Desktop の `MemoEditor` を単一コンポーネントとして共有する構造に刷新。当初案（Mobile 用 schema-only 拡張 8 ファイル）では NodeView 欠落で Callout 等が「ただの div」に崩れるため棄却し、レスポンシブ CSS + touch 環境検出で UI/UX を分岐する方向へ転換。Part B（マルチインスタンス DB 同期）は計画書に残り Phase A のみ先行着地。tsc 0 / Vitest 231 pass（+4 hooks test）/ ESLint 変更行クリーン。

#### 変更点

- **`useIsTouchDevice` フック新設**: `frontend/src/hooks/useIsTouchDevice.ts` — `window.matchMedia("(hover: none) and (pointer: coarse)")` で touch デバイスを判定。初期 state は同期評価、`MediaQueryList.addEventListener("change", ...)` で実行時変更にも追従（cleanup 済）。4 ケースの Vitest（初期 true/false / change 伝播 / unmount 時 listener removal）を `useIsTouchDevice.test.ts` に追加
- **`MemoEditor` を Mobile でも直接使用**: `frontend/src/components/Tasks/TaskDetail/MemoEditor.tsx` に `const isTouch = useIsTouchDevice()` を導入し、`BlockContextMenu` を `!isTouch && contextMenu &&` で条件マウント（hover 前提 UI のため）。ルート div の className を `relative mx-auto w-full max-w-full px-2 md:max-w-[760px] md:pl-10 md:pr-0` に変更（Mobile で横余白を縮小、`md:` 以上で従来どおりの 760px + pl-10）
- **`enableContentCheck` + `onContentError` 追加**: `MemoEditor` / `MobileRichEditor`（削除前）の `useEditor` オプションに `enableContentCheck: true` と `onContentError` を追加し、schema 不整合が発生した場合は `console.warn("[MemoEditor] TipTap content schema error", ...)` で可視化。従来のサイレントクリアを廃止
- **Mobile ビューを LazyMemoEditor 直接使用に差替え**: `MobileNoteView.tsx` / `MobileMemoView.tsx` から `MobileRichEditor` を撤去し、`LazyMemoEditor as MemoEditor` を `Suspense` 付きで使用。`entityType="note"` / `entityType="memo"` + `syncEntityId={memo?.id}` を渡して WikiTag / NoteLink 同期を有効化
- **旧 Mobile 専用アセット削除**: `frontend/src/components/Mobile/shared/MobileRichEditor.tsx`（約 160 行）を削除。`frontend/src/extensions/mobile/` ディレクトリ一式（MobileCallout / MobileToggleList / MobileWikiTag / MobileNoteLink / MobileDatabaseBlock / MobilePdfAttachment / MobileResizableImage + index.ts、約 350 行）を削除
- **Provider 整合性**: `main.tsx` の Mobile provider tree に既に `WikiTagProvider` が含まれていることを確認（`useWikiTagSync` が Mobile でも動作）。`NoteLinkSuggestionMenu` は `useNoteContext`（Mobile tree 内）依存のため追加不要。Suggestion メニュー（WikiTag/NoteLink の `@#` 補完）は user 指定により Mobile でも有効化
- **計画書更新**: `.claude/2026-04-20-mobile-editor-schema-parity.md` の Status を `IN PROGRESS (Part A 完了)` に更新、Part A の章を「旧方針（schema-only）→ 新方針（MemoEditor 共有）」に書き直して Steps A.1-A.5 を完了マーク。Part B（マルチインスタンス DB 同期）は変更なし
- **手動検証（未実施）**: iOS 実機で Callout / ToggleList / WikiTag / NoteLink / Table / TaskList の構造込みレンダリング確認 / Touch デバイスで BlockContextMenu が非表示・Bubble toolbar / Suggestion menu が動作することの確認
- **検証**: `npx tsc --noEmit` 0 / `npm run test -- --run` 28 files 231 pass / `npx eslint` 変更ファイル 0 errors（MemoEditor:437 の `react-hooks/immutability` 既存警告は commit `6c148b4` 由来で本セッション外）

---

### 2026-04-20 - Cloud Sync ブロッカー 3 件解消 + iOS 署名検証 + Notes Mobile 空表示の根本原因特定

#### 概要

iOS を 4G 環境でリモート同期させるための下準備として、Known Issues 004（`sync_last_synced_at` 未保存）/ 005（`tasks.updated_at` NULL）/ 008（routine-group-calendar tag_assignments が delta sync に乗らない）の 3 件を解消。既存 `.ipa` を codesign で検証し署名状態が健康（Bundle ID `com.lifeEditor.app.newlife` / Team `542QHWHN37` / Provisioning Profile 期限 2026/04/25）であることを確認、再生成不要と判定。並行して Notes の Mobile 詳細タップ時に本文が空になる症状の根本原因を特定（診断のみ、修正は次セッションへ）。cargo test 10 pass / Vitest 227 pass / tsc 0 / eslint clean。

#### 変更点

- **Known Issue 004 修正（防御ガード）**: `src-tauri/src/commands/sync_commands.rs` の `sync_trigger` read path に `.filter(|s| !s.is_empty())` を挟み空文字列を 1970 fallback 扱いに、`sync_trigger` と `sync_full_download` の write path に `if !remote.timestamp.is_empty()` ガードを追加。Cloud Workers は常に ISO timestamp を返すため実害は低いが、Workers 側に異常があっても `sync_last_synced_at` が空文字列で汚染されて `since=""` が全件マッチする事故を防ぐ
- **Known Issue 005 修正（V62 migration）**: `src-tauri/src/db/migrations.rs` に V62 ブロックを追加 — 10 versioned テーブル（tasks / memos / notes / schedule_items / routines / wiki_tags / time_memos / calendars / templates / routine_groups）の NULL `updated_at` を `strftime('%Y-%m-%dT%H:%M:%S.000Z', 'now')` で backfill + `tasks_updated_at_insert` トリガー（`AFTER INSERT ON tasks FOR EACH ROW WHEN NEW.updated_at IS NULL`）で INSERT 時の自動補完を保証
- **Migration runner 修正**: Fresh DB が `create_full_schema` → `user_version = 61` で early return して V62+ がスキップされる問題を発見 → `if current_version < 1` ブロックで `start_version = 61` として `run_incremental_migrations(conn, 61)` に合流する構造に変更。これで fresh DB でもトリガー・backfill が確実に適用される
- **Migration テスト追加**: `v62_migration_is_idempotent` / `v62_backfills_null_updated_at_and_installs_trigger`（NULL updated*at の task を 2 件 INSERT → migration で backfill + INSERT トリガーの動作検証）を追加、既存 `fresh_db_reaches_v61*_`を`fresh*db_reaches_latest*_`にリネームして期待値を 62 に更新、他 3 件の期待値も 61 → 62 に修正。cargo test`--lib db::migrations` 6 件 pass
- **Known Issue 008 修正（delta sync 親 bump）**: 3 箇所の `set_tags_for_*` 関数に親エンティティの `updated_at + version` bump を追加
  - `src-tauri/src/db/routine_tag_repository.rs::set_tags_for_routine` → `UPDATE routines SET updated_at = datetime('now'), version = version + 1`
  - `src-tauri/src/db/routine_group_repository.rs::set_tags_for_group` → `UPDATE routine_groups SET ...`
  - `src-tauri/src/db/calendar_tag_repository.rs::set_tags_for_schedule_item` → `UPDATE schedule_items SET ...`
  - これで sync_engine の delta query `WHERE r.updated_at > ?1` / `WHERE rg.updated_at > ?1` / `WHERE si.updated_at > ?1` がタグ付け替えを検知できるようになる
- **Known Issue 008 修正（fail-safe フィルタ緩和）**: `frontend/src/utils/routineScheduleSync.ts::shouldCreateRoutineItem` からタグ必須条件（`if (!routineTagIds || routineTagIds.length === 0) return false`）を削除。これまではタグ 0 件の routine を「削除対象」と判定し `ensureRoutineItemsForDateRange` が未来の schedule_items を消していたが、この過敏な挙動を止めてタグフィルタは表示層のみで行う設計に変更。引数 `tagAssignments` は call-site 互換のため `_tagAssignments` として残置
- **Known Issue 008 新規起票**: `.claude/docs/known-issues/008-routine-tag-assignments-delta-sync-invisible.md` を作成。症状（Desktop DB で `routine_tag_assignments` 0 件 / `routine_group_tag_assignments` 0 件 / 今日の routine schedule_items 0 件）、Root Cause（relation テーブルの delta sync が親 updated_at に依存するが親を bump していなかった）、Fix（3 箇所の bump + フィルタ緩和）、Lessons Learned（「relation + 親依存」は delta sync で壊れやすい、書き込み判定は読み取り判定より保守的に）を記録
- **Known Issue 004 / 005 Fixed 化**: INDEX.md の Active 2 件を Fixed に移動し Resolved 日付 2026-04-20 を付与、Status 集計を Active:0 / Fixed:7 に更新。Category 別索引に `Sync: 008` を追加
- **Vision ドキュメント更新**: `.claude/docs/vision/ios-everywhere-sync.md` §同期設計の「ブロッカー」記述を「2026-04-20 に解消」へ書き換え、CLAUDE.md §4.1 の DB 現行 version を v60 → v62 に更新（V62 要約を 1 行追加）
- **Notes Mobile 空表示の根本原因特定（診断のみ）**: DB の `notes.content` を直接観測して Desktop 保存データに `callout` / カスタム `heading` attrs (`backgroundColor`, `fontSize`) / カスタム `paragraph` attrs (`backgroundColor`) / `toggle*` 等のカスタム node が含まれることを確認。`MobileRichEditor` は StarterKit + Placeholder のみで、Desktop の `CustomHeading` / `BlockBackground` / `Callout` / `ToggleList` / `WikiTag` / `NoteLink` / `DatabaseBlock` / `PdfAttachment` / `ResizableImage` / `Table*` / `TaskList*` / `TextStyle` / `Color` / `Highlight` / `Link` を持たない → ProseMirror の schema 解釈で未知 node に遭遇し document 全体を空の `{type:"doc", content:[]}` に fallback。list preview が見えるのは `extractPlainText` が schema を介さず JSON を walk するため。修正案 A（全拡張 import） / 案 B（read-only fallback） / 案 C（軽量拡張のみ追加）は次セッションで決定
- **Routine Desktop 非表示の根本原因特定 + 修正**: DB 観測で Desktop の `routine_tag_assignments` が 0 件 / 今日の routine schedule_items が 0 件（将来 164 件は月グリッド範囲外で残存）と判明。バグの連鎖: (1) `set_tags_for_routine` が親 updated_at を bump しない → (2) sync の delta query が拾えない → (3) Desktop の tagAssignments 空 → (4) `shouldCreateRoutineItem` が false → (5) `ensureRoutineItemsForDateRange` が未来の schedule_items を削除 → (6) `MiniTodayFlow` が `if (!scheduleItem) continue;` で routine 自体を非表示化。iOS で見えていたのは Mobile UI が `shouldCreateRoutineItem` フィルタを通さず `ensureRoutineItemsForDateRange` の削除も走らないため
- **iOS Xcode 署名状態の検証**: 既存 `src-tauri/gen/apple/build/life-editor_iOS.xcarchive/Products/Applications/Life Editor.app` に対して `codesign -dvv` を実行、Bundle ID / Team ID / 証明書（`Apple Development: 2201akonayu@gmail.com (FVMH4L98Q3)` 有効期限 2027/04/18） / Provisioning Profile（`5ee1134c-...` 有効期限 2026/04/25、`~/Library/Developer/Xcode/UserData/Provisioning Profiles/` にインストール済み） が `project.yml` / `tauri.conf.json` と完全一致することを確認。Bundle ID は 1 回しか登録しておらず 10 App ID/7 日枠の消費ゼロ、Known Issue 007 対策の `DEVELOPMENT_TEAM` / `CODE_SIGN_STYLE` も既に project.yml 内に記入済みのため XcodeGen 再生成も安全。再署名までの残日数 5 日、本週中に 4G 検証を完了する方針
- **残タスク**: (a) アプリ再起動して V62 migration を実 DB に適用 → `PRAGMA user_version` が 62 / `tasks_updated_at_insert` トリガー存在の確認、(b) iOS で Full Re-sync → Cloud にタグ情報を押し戻す → Desktop で Full Re-sync して `routine_tag_assignments` を復元、(c) Wi-Fi で Desktop ↔ iOS の双方向 sync 検証、(d) 4G に切り替えて再検証、(e) Notes Mobile 空表示の修正方針決定 + 実装
- **検証**: `cargo check` 0 / `cargo test --lib` 10 pass / `cd frontend && npx vitest run` 227 pass / `npx tsc --noEmit` 0

---

### 2026-04-19 - Tipsパネル再設計 + Terminalセクション化 + LeftSidebar コンパクト化（計画書: 外部 `~/.claude/plans/leftsidebar-font-size-2px-rosy-beaver.md`）

#### 概要

Tips を「画面下部固定 / セクション 4 件のみ」から「LeftSidebar 下部のトグルボタン + 中央エリア下部の半透明オーバーレイ + サブカテゴリタブで多数件を縦スクロール表示」に刷新。Terminal は dock/resize/minimize を全削除し、TitleBar のターミナルアイコン (Undo/Redo の左隣) と `Cmd/Ctrl+J` で開閉する全画面セクション化。LeftSidebar は font-size 16px 固定 + padding/space を縮小してコンパクト化。Tips 内容は実装を 3 並列 Explore エージェントで調査して未実装機能の記述を削除し、内部用語を「右サイドバー」「鉛筆アイコン」「▶ ボタン」など分かりやすい言葉に統一。Analytics 専用 Tips も追加。en/ja 同期 (382 keys 各)、tsc / eslint（本セッション範囲）クリーン、Vitest 227 pass。

#### 変更点

- **Tips パネル UI 刷新**: `components/shared/TipsPanel.tsx` を全面書き換え。`isOpen` / `onClose` props で親制御化、`absolute inset-x-0 bottom-0 max-h-[55vh]` で中央エリア内の下部オーバーレイ配置（LeftSidebar / RightSidebar に被らない）、`bg-notion-bg-secondary/70 backdrop-blur-sm` で半透明（カード/ヘッダは不透明）、ヘッダ部にサブカテゴリタブ（横スクロール対応）+ 1 カラム縦スクロールリスト。`useLocalStorage(STORAGE_KEYS.TIPS_TAB_PREFIX + section)` でセクション別にアクティブタブを永続化
- **Tips データ構造**: `types/tips.ts` に `TipsTabDefinition` 追加（`{ id, labelKey, icon, tips: TipDefinition[] }`）。`TipsSectionId` を `schedule | work | materials | connect | terminal | analytics` の 6 セクションに拡張。`config/sectionTips.ts` を新規作成して 6 セクション × 4 タブ × 6〜10 件の Tips を `makeTip(section, tab, item, icon)` ヘルパで定義（合計 174 Tips）
- **Tips コンテンツ正確化**: 3 並列 Explore エージェントで Schedule/Materials/Connect/Work/Analytics/Terminal の実装を調査し、未実装機能の記述を削除 — Calendar 日ビュー / 月表示ドラッグ / Calendar 右クリック追加 / Calendar タグフィルタ / ルーティンスキップ / DayFlow 完了非表示 / DayFlow 複数選択編集 / Stats タブ（→ 右サイドバー Achievement パネル）/ ヒートマップ画面 / 週比較 / Materials ホバープレビュー / 壊れたリンク警告 / Connect タグ統合 / 音源リンク / ルーティンリンク / Backlink リンク昇格 / ビュー保存 / プリセットフィルタ / Work お気に入りピン / プリセット保存 / 環境音 6 種ミキサー / ヘッドホンモード / 休憩中ミュート / Terminal Cmd+F 検索 / Cmd+K クリア / CSV エクスポート（予定）。代わりに実装通りの操作（カレンダー日付の Repeat アイコン → ルーティン管理 / 右サイドバー Achievement の + ボタン / Day Flow Today ボタン / + Add Custom Sound / Sound Tags 等）に置換。内部用語（WikiTag / DayFlow 等）は「タグ」「Day Flow タブ」のように整理し、操作場所を明示（右サイドバー / Undo/Redo の左隣 / 鉛筆アイコン 等）
- **Analytics 専用 Tips 追加**: 4 タブ（Overview / Tasks / Time / Knowledge）× 各 6〜7 件。Today ダッシュボード / 期間セレクタ（右サイドバー） / 日付プリセット / 週次サマリ / Streak / 6 タブ切替 / 完了トレンド / 停滞チャート / 作業ヒートマップ / ポモドーロ達成率 / メモヒートマップ / タグ使用頻度 等を実装に沿って記述
- **Terminal セクション化**: `types/taskTree.ts` の `SectionId` に `"terminal"` 追加。`components/Terminal/TerminalSection.tsx` 新規（既存 `useTerminalLayout` / `SplitLayout` / `TerminalTabBar` を再利用、dock/resize/minimize 関連 prop を全削除した薄いラッパー）。`components/Terminal/TerminalPanel.tsx` を削除。`Layout.tsx` で TerminalSection を中央エリアに永続マウントし、`activeSection === "terminal"` のとき `display:flex` / それ以外 `display:none` で表示切替（PTY セッションを保持）
- **TitleBar Claude起動ボタン**: `components/Layout/TitleBar.tsx` に Undo/Redo の左隣に Terminal アイコンボタンを追加。クリックで `activeSection` を `"terminal"` に切替 + `launchClaude()` 実行。`SECTION_UNDO_DOMAINS` には `terminal` を未追加（Undo 対象外）
- **LeftSidebar Tips ボタン**: `LeftSidebar.tsx` / `CollapsedSidebar.tsx` の旧 [Claude 起動] 位置に [Tips] ボタン（Lightbulb アイコン）を配置 → `onToggleTips` で Tips オーバーレイをトグル。Layout から `tipsOpen` state（`useLocalStorage(STORAGE_KEYS.TIPS_OPEN)`）を渡してアクティブ表示
- **LeftSidebar コンパクト化**: 全メニューボタンを `style={{ fontSize: 16, lineHeight: 1.25 }}` に固定（旧 `text-scaling-sm` から脱却）、`py-2` → `py-1.5`、`space-y-1` → `space-y-0.5`、`p-3` → `p-2`、Timer ミニ表示の padding/フォントも同調縮小。アイコンは 18px 維持
- **Storage Keys 整理**: `TERMINAL_OPEN` / `TERMINAL_HEIGHT` / `TERMINAL_DOCK` / `TERMINAL_WIDTH` / `TIPS_COLLAPSED` を削除。`TIPS_OPEN` / `TIPS_TAB_PREFIX` を追加
- **Layout 統合**: dock 関連 state / 分岐ロジックを全削除して中央エリア構造を `flex-col` に単純化。`launchClaude` の実装を「セクション切替 + Claude コマンド送信」に簡素化（旧: terminal 開閉 + Claude 起動）。`view:toggle-terminal` キーボードショートカットを `activeSection` 切替ベースに変更（previousSectionRef で復元先を記憶）
- **App.tsx**: `terminalCommandRef` を Layout に渡すよう更新、`renderContent()` の switch に `case "terminal": return null` 追加（実体は Layout 内に永続マウント）
- **i18n**: en/ja 両方で `tips.*` ブロックを完全置換（370 参照キー、382 公開キー、両言語完全一致）。`sidebar.tipsButton`, `sidebar.launchClaude` 維持。jq でマージして JSON 整合性を確認
- **検証**: `tsc --noEmit -p tsconfig.app.json`（本セッション範囲エラーなし、pre-existing 2 件は IdeasView / MobileRichEditor）/ `npm run lint`（本セッション範囲エラーなし）/ `vitest run` 27 → 28 ファイル、222 → 227 pass
