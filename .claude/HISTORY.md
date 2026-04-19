# HISTORY.md - 変更履歴

### 2026-04-19 - Connect Canvas UX 改善（WikiTag インライン軽量化 / Connect モード + ConnectPanel / Link エッジ / 矩形選択 Pan/Select 切替）（計画書: 外部 `~/.claude/plans/1-wikitags-block-line-height-tags-paddin-curried-bachman.md`）

#### 概要

Connect セクション Node タブ (`TagGraphView`) での「ノード関連付け」体験を 3 点一括改善。(1) 本文中の WikiTag (`.wiki-tag-modern`) の padding-block / 背景 / 枠を削って line-height 内に収まる軽量デザインへ、(2) CanvasControls の 4 ボタン (ZoomIn / ZoomOut / FitView / Filter) に 5 つ目として Connect トグルを追加し、ON 時はノード間ドラッグで `ConnectPanel` を開く新規タグ作成 / 既存タグ選択 → 両 Node へ必ず付与する接続操作を実装、(3) V61 の `note_links` テーブルを TagGraphView のエッジ描画に取り込み、既存タグエッジ（solid）と区別するため破線 emerald（`strokeDasharray: "5 3"`）で表示し Filter パネルに「ノートリンク」ON/OFF トグルを追加。併せてユーザー要望に応じて、Node / Board 両 Canvas の Pan / 選択モードを反転 —— 空白ドラッグは青色矩形選択、二本指スワイプで Pan、Delete/Backspace で選択ノードを一括ソフト削除、ピンチで Zoom。Connect モード中は矩形選択と Delete キーを停止して接続ドラッグとの衝突を回避。Vitest 227/227 pass（新規 5 件）/ `tsc --noEmit` 0 / ESLint（本 PR 範囲）クリーン。

#### 変更点

- **WikiTag インライン軽量化**: `index.css` の `.memo-editor .wiki-tag-modern` を `padding: 0.15rem 0.4rem` + `background: var(--color-hover)` + `border: 1px solid transparent` + `font-size: 0.85em` → `padding: 0 0.25rem` + `background: color-mix(in srgb, var(--color-hover) 55%, transparent)` + `border: none` + `font-size: 0.88em` + `line-height: inherit` + `vertical-align: baseline` に刷新。hover は背景をフル不透明度に切替 + `color: var(--color-accent)` で状態変化を示す。`WikiTagChip` バッジ表示は意図的に手つかず
- **Connect モードボタン**: `CanvasControls.tsx` に `showConnect` / `connectMode` / `onToggleConnectMode` / `connectLabel` プロップスを追加し、Spline アイコンの 5 つ目トグルボタンを追加。`aria-pressed` + `connectMode` 時 `bg-notion-accent text-white` でアクティブ表示。`showConnect={!sidebarMode}` で Split View 時には非表示
- **ConnectPanel 新規**: `components/Ideas/Connect/ConnectPanel.tsx`。`createPortal` で overlay + 420px モーダル、Search 入力 / タグリスト（両側に既割当のタグは disabled + `alreadyLinked` バッジ）/ クエリが既存タグ名と完全一致しない && 非空時に「"{name}" を新規タグとして作成」項目、Connect は `selectedTagId || query.trim()` が無い時 disabled、Cancel / Esc で閉じる / Enter で確定。IME 対応 (`e.nativeEvent.isComposing`)
- **TagGraphView 配線**: `connectMode` / `pendingConnection` state 追加。`handleConnect` は `connectMode` 時に `resolveNodeInfo` で Note/Memo 種別を判定して ConnectPanel を開き、通常時は既存 `noteConnection` 作成へフォールバック。`handleConfirmConnect` が `onConnectViaTag` prop を経由して「必要なら新規タグ作成 → 両 Node に `setTagsForEntity`」を実行。Connect モード時のみ `nodesConnectable={true}` + `nodesDraggable={false}` + CSS `tag-graph-connect-mode` でノード hover カーソルを crosshair 化
- **ConnectView handler**: `useWikiTags().createTag` を追加取得し `handleConnectViaTag` を新設（新規タグなら `createTag(name, color)` → 両 Node 分 `setTagsForEntity`）。既存 `handleCreateNoteConnection` の manual noteConnection フローは互換のため残置
- **Link エッジ描画**: `useNoteLinksGraph.ts` 新規（`getDataService().fetchAllNoteLinks()` を mount 時に呼び、`isDeleted=0` のみ state 保持、`life-editor:note-links-changed` CustomEvent を購読して自動再 fetch）+ `dispatchNoteLinksChanged()` export。`useNoteLinkSync.ts` の upsert 成功後に `dispatchNoteLinksChanged()` を呼んで Canvas を同期。`TagGraphView.buildNormalEdges()` の末尾に linkEdges 合成を追加（`source_memo_date` のケースは `memo-YYYY-MM-DD` に組み立て、`pairEdgeCount` と共有して同ペアの tag / manual / link エッジが曲率オフセットで重ならない）。スタイルは `stroke: #10b981` / `strokeDasharray: "5 3"` / `strokeWidth: 1.5` / `opacity: 0.75`
- **Filter: Note Links トグル**: `displayFilterItems` 末尾に `VIRTUAL_LINK_EDGES_HIDDEN_ID` の仮想フィルタを常設。`activeFilterIds.has(VIRTUAL_LINK_EDGES_HIDDEN_ID)` が true の時 `linkEdges = []` として描画を抑止。`activeFilterResult` の decompose で同 ID を `realTagIds` に混入させない分岐を追加
- **Pan / 選択モード切替**: `TagGraphView` と `PaperCanvasView` 両方の `<ReactFlow>` に `panOnDrag={false}` / `selectionOnDrag={!connectMode}`（Paper は常時 true）/ `selectNodesOnDrag={false}` / `panOnScroll` / `zoomOnScroll={false}` / `zoomOnPinch` を追加。二本指トラックパッドスワイプが scroll event として Pan に変換され、ピンチズームは維持。マウスホイール直接ズームは無効化（ズームはピンチ / zoom ボタン / fitView で対応）
- **一括ソフト削除**: `TagGraphView` に `deleteKeyCode={connectMode ? null : ["Delete", "Backspace"]}` + `multiSelectionKeyCode="Shift"` + `onNodesDelete={handleNodesDelete}` を追加。`handleNodesDelete` は削除対象ノードを `node.type === "noteNode"` / `"memoNode"` で分岐し、Memo は `node.id.startsWith("memo-")` から日付を復元して `deleteMemo(date)` を、Note は `softDeleteNote(noteId)` を呼び出す。`ConnectView` 側で `useMemoContext().deleteMemo` / `useNoteContext().softDeleteNote` を `onDeleteMemoEntity` / `onDeleteNoteEntity` として TagGraphView に渡す。`PaperCanvasView` は既存の `deleteKeyCode` + `handleDeleteSelected` を流用
- **i18n**: en / ja 両方に `connect.toggleConnectMode` / `connect.linkEdges` / `connect.panel.{title, searchPlaceholder, createNew, connect, cancel, alreadyLinked, noTags}` を追加
- **テスト**: `src/hooks/useNoteLinksGraph.test.ts` を新規追加（fetches on mount / filters soft-deleted / refetches on dispatch event / cleans up listener on unmount / logs `console.warn` on fetch error、計 5 件）。`createMockDataService` は `fetchAllNoteLinks` を持たないためテスト内でランタイム上書き（mockDataService 自体は `tsconfig.app.json` の exclude 下にあり tsc 対象外）
- **CSS**: `.tag-graph-connect-mode .react-flow__node:hover { cursor: crosshair !important; }` を追加
- **検証**: `npx tsc --noEmit` 0 / `npx eslint` 本 PR 範囲クリーン（`PaperCanvasView.tsx` の既存 `isDescendant` / `getMaxSubtreeDepth` の React Compiler immutability / use-before-declared 警告 6 件は commit `aced45ed` 由来でセッション範囲外）/ `npx vitest run` 27 files → 28 files, 222 → 227 pass

---

### 2026-04-19 - Obsidian Phase 1 フォローアップ（記法分離 `@`化 / アイコン表示 / Daily Memo→Notes 遷移 / routine_groups.version sync fix）

#### 概要

Phase 1 リリース後にユーザーから挙がった 3 件の不具合・UX 課題を一括対応。`[[NoteName]]` NoteLink と `#tag` WikiTag が同じ `#` キーを奪い合っていた問題を「`[[` = Note Link / `@` = WikiTag」の完全分離に変更し、両者の表示を「括弧・記号なし、lucide アイコン + 名前のみ」に刷新。Daily Memo 中のノートリンクをクリックしても遷移しなかった問題を CustomEvent → App.tsx の useEffect リスナー経由で Materials タブ + Notes サブタブに自動切替する形で解決。さらに Cloud Sync の UPSERT が `excluded.version > ...` を参照する一方で V42 世代 DB の `routine_groups` に `version` 列が無かったバグを防御的 ALTER で修正。cargo migration tests 5 件 pass、Vitest 222 pass、tsc / eslint クリーン。

#### 変更点

- **WikiTag トリガ `#` → `@`**: `hooks/useWikiTagSuggestion.ts` の正規表現を `/(?:^|\s)@([^\s@]*)$/` に変更。NoteLink (`[[`) と明確に分離し、どちらのサジェストも競合なく起動
- **WikiTag 表示刷新**: `extensions/WikiTag.ts` の renderHTML から `#` プレフィックスを除去（`tagName` のみ出力）。`extensions/WikiTagView.tsx` で `<span>#</span>` を `<Tag />` lucide アイコン（size=12）に置換し、`.wiki-tag-symbol` CSS を `.wiki-tag-icon` に刷新（`index.css`）
- **NoteLink 表示刷新**: `extensions/NoteLink.ts` の renderHTML から `[[...]]` 括弧を完全撤去（`label = alias ?? title` のみ）。`extensions/NoteLinkView.tsx` で `note-link-bracket` span 群を `<Link />` lucide アイコンに置換し、heading/blockId suffix は半角スペース区切りの ` #Heading ^block` 表記に変更（可読性向上）。`.note-link` スタイルを `inline-flex + gap:3px + align-items:center` に切替
- **Daily Memo → Notes 遷移**: `constants/events.ts` 新規（`NAVIGATE_TO_NOTE_EVENT` + `NavigateToNoteDetail` 型）。`NoteLinkView` の onClick で `setSelectedNoteId` 直接呼び出しを廃止し `window.dispatchEvent(CustomEvent)` に変更。`App.tsx` に useEffect リスナーを追加し、受信時に `localStorage.MATERIALS_TAB='notes'` + `setActiveSection('materials')` + `setSelectedNoteId(detail.noteId)` を連動実行
- **routine_groups.version sync 修正**: `src-tauri/src/db/migrations.rs` 末尾の defensive block に `has_column('routine_groups','version')` ガード付き ALTER を追加。V42 で作成された DB は `version` 列が無く `sync_engine.upsert_versioned` の UPSERT（`excluded.version > "routine_groups".version`）が `no such column: excluded.version` で失敗していた。既存の `schedule_items.template_id` 防御パターンを踏襲
- **テスト追加**: Rust `routine_groups_version_column_backfilled_on_upgrade` 新規（V42 世代スキーマを in-memory 再現し `run_migrations` 後に `version` 列が存在することを検証）。既存 4 件と合わせて cargo test `--lib migrations` 5 件 pass
- **i18n 更新**: en/ja の `wikiTags.description` / `wikiTags.empty` を `#tag` → `@tag` に更新。Tips `materials.linkSyntax` の説明文を「`[[` でノートリンク、`@` でタグ付与。確定後はアイコン + 名前のみ表示」に、Tips `connect.tags` の説明を「`@タグ名` で WikiTag を付与」に変更
- **互換性**: WikiTag Node の `name="wikiTag"` と parseHTML は維持。既存 TipTap JSON 内の `wikiTag` ノードと DB 内の `wiki_tag_assignments` は一切触らず、見た目だけ自動で新スタイルに切り替わる。NoteLink も同様（parseHTML 互換）

---

### 2026-04-19 - TerminalPanel 直上 Tips セクション追加（Schedule / Work / Materials / Connect の 4 セクション × 4 Tips）

#### 概要

Claude 起動ボタン直上（Layout center column の MainContent と TerminalPanel の間）に activeSection 連動の折りたたみ式 Tips パネルを新設。4 セクションそれぞれに「主要操作 + lucide アイコン + 1-2 文説明」の Tips を 4 件ずつ掲載し、折りたたみ状態を localStorage に永続化。Tier 1 コア機能の使い方を初見でも拾えるようにするオンボーディング補助。`analytics` / `settings` では自動非表示。

#### 変更点

- **新規**: `types/tips.ts`（TipDefinition + TipsSectionId 型）/ `config/sectionTips.ts`（4 セクション × 4 Tips の lucide アイコン付き定義、docsPath は任意）/ `components/shared/TipsPanel.tsx`（activeSection prop 受け取り、折りたたみ UI、`useLocalStorage(TIPS_COLLAPSED)` で永続化、2 カラム grid レイアウト + docsPath 存在時のみ「詳細を見る」リンク）/ `constants/events.ts`（後続 PR で NoteLink 遷移にも利用）
- **STORAGE_KEYS 追加**: `TIPS_COLLAPSED: "life-editor-tips-collapsed"`（`constants/storageKeys.ts`）
- **Layout.tsx 統合**: center column 内の `<MainContent>` と `<TerminalPanel>` の間に `<TipsPanel activeSection={activeSection} />` を挿入。dock="bottom" 時は Terminal 直上、dock="right" 時も MainContent 直下に残る自然配置
- **Tips 内容（12 セクション × 各 4 = 16 Tips）**:
  - Schedule: 月/週/日切替（m/w/d キー）/ ルーティン追加（頻度指定）/ Day Flow 時系列表示 / 達成率追跡（90 日ヒートマップ）
  - Work: タスク選択 or フリーセッション / タイマー操作（Space/R）/ ポモドーロ設定・プリセット / 6 種環境音ミックス
  - Materials: 日記の自動保存 / ノート作成・フォルダ階層 / `[[` と `@` のリンク記法 / ファイル参照
  - Connect: グラフ可視化 / `@タグ名` で関連付け / Backlinks + Unlinked Mentions / 検索・フィルター
- **i18n**: en/ja 両方に `tips.{panel,schedule,work,materials,connect}.*` を追加（各セクション header + 4 Tips × {title, description} + panel 操作ラベル 3 件）。既存 `sidebar.tips="ヒント"` と区別
- **検証**: tsc clean / eslint clean / Vitest 222/222 pass
- **Phase 2 余地**: `docsPath` をフィールドとして残したため、`.claude/docs/code-explanation/` に Schedule / Work / Materials / Connect 向け解説を追加すれば自動でリンク表示される設計

---

### 2026-04-19 - Mobile DayFlow 完了 UI / 長押し DnD / フォーム & Settings コンパクト化（計画書: 外部 `~/.claude/plans/mobile-task-event-routine-ui-ux-elegant-hinton.md`）

#### 概要

Mobile 版の DayFlow グリッドを「読み取り専用」から「完了操作 + 時間帯 DnD 可能」に昇格し、Edit Item フォームを 1 行 3 列 grid に再構成、Settings を 4 セクション（FontSize / Notifications / Timer / Trash）追加しつつ Export/Import ボタンをコンパクト化。データ層は既存の `toggleScheduleItemComplete` / `updateScheduleItem` / `updateTask` を再利用し IPC 層の変更なし。Vitest 222/222 pass、tsc 0 / eslint 0。

#### 変更点

- **DayFlow 完了 UI**: `MobileDayflowBlock.tsx` 新規。ブロックを「左端 6px color rail（タップで完了トグル）+ 右 content（タップで編集フォーム / 長押しで DnD）」の 2 ボタン構造に分割。Task は 3-state サイクル（NOT_STARTED → IN_PROGRESS → DONE）、IN_PROGRESS は rail を `repeating-linear-gradient` で破線表示して区別。完了時は `opacity:0.4` + `line-through` + 完了パレット背景
- **chipPalette 拡張**: `completedPalette()` 追加（`--color-chip-completed-{bg,fg,dot}` を light/dark 両方で定義）
- **DaySheet アニメ**: `DaySheetRow` のチェックボックスに `animate-check-in`（150ms scale pop、`@keyframes check-in` を `index.css` に追加）+ `navigator.vibrate?.(30)` + 完了時 `line-through`。花吹雪等の派手な演出は不要（ユーザー指示）
- **長押し DnD**: `useMobileLongPressDrag.ts` 新規フック。450ms 長押し + 8px moveTolerance + 5 分スナップ + スナップ境界越え時 vibrate。container に `touch-action:none` を動的適用してページスクロールを抑制。`dragStateRef` で最新 state を ref に保持し window listener の毎フレーム再バインドを回避
- **スナップ util**: `utils/mobileSnapTime.ts` に `hhmmToMinutes` / `minutesToHHMM` / `snapMinutes` / `topPxToMinutes` / `computeShiftedTimes`。duration を維持したまま start/end を同時スナップし 24h 境界でクランプ。9 件の unit test (`mobileSnapTime.test.ts`)
- **DragPreview**: `components/Mobile/schedule/DragPreview.tsx` 新規。半透明ブロック + スナップラインピル（開始/終了時刻のライブ表示）。ドラッグ中の元ブロックは `opacity:0.3`
- **MobileDayflowGrid 統合**: `gridRef` を追加し `useMobileLongPressDrag` を呼び出し。props に `onToggleScheduleComplete` / `onToggleTask` / `onReschedule` を追加
- **MobileCalendarView 配線**: `handleReschedule` を追加し `kind === "task"` のとき `updateTask({ scheduledAt, scheduledEndAt })`、それ以外は `updateScheduleItem({ startTime, endTime })` に分岐。Mobile は TaskTreeProvider を使わないため `loadTasks()` / `loadMonthItems()` で再取得
- **Edit Item フォームコンパクト化**: `MobileScheduleItemForm.tsx` で Date + Start + End を `grid-cols-[1.3fr_1fr_1fr]` の 1 行 3 列化（isAllDay 時は Date のみ）。label を `text-[10px] uppercase tracking-wider`、input を `py-1.5 px-2 text-[13px]`、section 間 `space-y-3`、action ボタン `py-2 px-3.5`
- **Settings primitives**: `components/Mobile/settings/MobileSettingsPrimitives.tsx` 新規。`SettingsSection` / `PillOption` / `ToggleSwitch` / `CompactButton` を共通化
- **Settings コンパクト化**: Export/Import ボタンを `py-2.5 border-2 rounded-xl text-sm` → `py-2 border rounded-lg text-xs gap-1.5`、Theme/Language pill を `py-3 gap-2` → `py-2.5 gap-1.5`。`MobileSyncSection` も `CompactButton` を使用
- **FontSize セクション**: `MobileFontSizeSection.tsx` 新規。`useTheme.setFontSize(1-10)` を S=3 / M=5 / L=7 / XL=9 の 4 段階 pill に圧縮。`nearestPreset()` で最近傍判定
- **Notifications セクション**: `MobileNotificationsSection.tsx` 新規。`STORAGE_KEYS.NOTIFICATIONS_ENABLED` + Routine / Task deadline リマインダー flag。`window.Notification.requestPermission()` ゲート付き。未対応環境は disabled + "Not supported on this device" 表示。**実通知配信は別 PR**（plugin-notification 未導入）
- **Timer セクション**: `MobileTimerSection.tsx` 新規。`useTimerContext` の work/break/longBreak を range slider で編集、`isRunning` 時 disabled + 補足メッセージ
- **Trash セクション**: `MobileTrashSection.tsx` 新規。`fetchDeletedScheduleItems` + `fetchDeletedTasks` を並列取得して統合リスト（schedule/task ラベル付き、最大 100 件、`deletedAt` 降順）。Restore / 完全削除 2 ボタン
- **i18n**: `mobile.schedule.form.{dateLabel,startLabel,endLabel}` / `mobile.settings.{fontSize,notifications.*,timer.*,trash.*}` を en/ja 両方に追加
- **バグパターン修正**: session-verifier Gate 6 で `useMobileLongPressDrag` の `endDrag` が `dragState.previewTop` に依存して毎フレーム window listener を再バインドする問題を発見 → `dragStateRef` + `updateDragState` 経由で ref から最新 state を読む形にリファクタ。deps に含めて exhaustive-deps 警告も解消
- **検証**: `npx tsc --noEmit` EXIT=0 / `npx eslint` EXIT=0（変更範囲）/ `npx vitest run` 222/222 pass

---

### 2026-04-19 - Notes / Memos Obsidian 風知識結晶化 Phase 1（計画書: 外部 `~/.claude/plans/1-notes-memos-notes-2-binary-muffin.md`）

#### 概要

Obsidian の「ノート間直接リンク / Backlinks / 記法分離」を Life Editor の Notes / Memos に移植する Phase 1 基礎実装。`[[NoteName]]` = Note Link（新規）、`#tag` = WikiTag（既存データ流用）に記法を分離し、DB V61 で `note_links` / `note_aliases` テーブルを追加、TipTap Extension + 自動補完 + Backlinks ペインを Desktop の NotesView に統合した。計画書の 8 週工程のうち Phase 1（Week 1-4 相当）を完了。Phase 2+（Properties / Embed / BlockRef / LocalGraph / MCP 5 ツール / V62-V64）は次セッション以降。

#### 変更点

- **DB V61 新規**: `note_links`（id/source_note_id/source_memo_date/target_note_id/target_heading/target_block_id/alias/link_type CHECK(inline|embed)/timestamps/version/soft-delete）+ `note_aliases`（UNIQUE alias レジストリ）。`create_full_schema` + 増分マイグレーション両対応、`PRAGMA user_version` を 61 に、インデックス 7 本追加。V61 専用テストと既存 V60 テスト 3 件を V61 対応に更新
- **Rust Backend（3 ファイル）**: `note_link_repository.rs`（fetch_all / fetch_forward_links / fetch_backlinks with JOIN notes / upsert_links_for_note / upsert_links_for_memo / delete_links_for_note / fetch_unlinked_mentions）+ 4 単体テスト。`note_link_commands.rs` で Tauri command 7 本。`lib.rs` の `generate_handler![]` に 7 コマンド登録（IPC 4 点同期）
- **DataService / TauriDataService**: 7 メソッド追加（`fetchAllNoteLinks` / `fetchForwardLinksForNote` / `fetchBacklinksForNote` / `upsertNoteLinksForNote` / `upsertNoteLinksForMemo` / `deleteNoteLinksForNote` / `fetchUnlinkedMentions`）。`types/noteLink.ts` 新規（NoteLink / NoteLinkPayload / BacklinkHit / UnlinkedMention）
- **TipTap `NoteLink` Extension**: `extensions/NoteLink.ts` + `NoteLinkView.tsx`。`[[NoteName]]` / `[[Note|alias]]` / `[[Note#Heading]]` / `[[Note#^block-id]]` / `![[…]]`（embed）を atom inline node として実装。broken 表示（targetNote 不在時は line-through）対応
- **Auto-complete**: `useNoteLinkSuggestion.ts`（`[[` または `![[` 検出 → `parseNoteLinkRaw` で `note#heading#^block|alias` 構造化 → ノートタイトル曖昧検索、`]]` 入力で自動確定）+ `NoteLinkSuggestionMenu.tsx`（MemoEditor 下に floating）
- **TipTap → DB 同期**: `useNoteLinkSync.ts` が編集内容から `extractNoteLinksFromTiptapJson` で NoteLinkPayload 抽出 → `upsertNoteLinksForNote` / `upsertNoteLinksForMemo` を editor update 毎に呼び出し（payloadKey diff で無駄な往復を排除）。`useWikiTagSync` と同一の debounce 相当パターン
- **Backlinks ペイン**: `useBacklinks.ts`（noteId + syncVersion に連動して backlinks + unlinkedMentions を並列 fetch）+ `components/Ideas/BacklinksPane.tsx`（Backlinks / Unlinked Mentions タブ切替、ソース単位グループ化 + heading/block suffix 表示、未リンク言及クリックで該当 Note 遷移）。`NotesView.tsx` の MemoEditor 直下に統合
- **WikiTag 記法分離（案 A: DB 無改修）**: `extensions/WikiTag.ts:44` の `renderHTML` を `[[${tagName}]]` → `#${tagName}` に変更（parseHTML と nodeType `wikiTag` は互換維持、DB 内 TipTap JSON を破壊しない）。`useWikiTagSuggestion` のトリガを `[[…]]` → `#…`（行頭 or 空白後のみ起動、ESC で閉じる）に書き換え。`useWikiTagSync` は触らず既存エンティティ割当ロジックを再利用
- **CSS**: `index.css` に `.note-link` / `.note-link-bracket` / `.note-link-text` / `.note-link-suffix` / `.note-link-broken` / `.note-link-embed` スタイル追加（accent color、embed は左 border + hover underline）
- **i18n（en/ja 同期）**: `noteLinks.{linkToNote,embedNote,noResults}` + `backlinks.{title,unlinkedMentions,empty,noUnlinkedMentions,loading}` 追加。`wikiTags.description` と `wikiTags.empty` の `[[タグ名]]` 表記を `#タグ名` に統一
- **テスト**: Vitest 13 件追加（`parseNoteLinkRaw` 8 件 / `extractNoteLinksFromTiptapJson` 5 件）+ Rust 6 件追加（migrations 3 件 / note_link_repository 4 件うち既存と重複なし）。全 Vitest 213 pass / Cargo test 8 pass / `tsc --noEmit` / `cargo check` クリーン

#### スコープ外（次フェーズに持ち越し）

- Phase 2: V62 `entity_properties` / `note_blocks` / TipTap `EmbedNote` / `BlockRef` / `PropertiesProvider` / `PropertiesPanel` / `LocalGraphView` / Global Graph 拡張 / Search 演算子 / Mobile ボタン式 UI
- Phase 3+: Slash Command / Nested Tags UI / Dataview-lite / Canvas 再検討
- MCP Server 5 ツール（`find_related_notes` / `summarize_by_tag` / `compose_from_notes` / `suggest_backlinks` / `find_zettelkasten_chain`）

<!-- older entries archived to HISTORY-archive.md -->
