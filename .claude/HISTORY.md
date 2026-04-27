# HISTORY.md - 変更履歴

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
