# HISTORY.md - 変更履歴

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

---

### 2026-04-19 - vision/ 整理 + Mobile 移植計画ドキュメント化

#### 概要

`.claude/docs/vision/` を「設計原則 + 次フェーズ計画」の 4 ファイル構成に再編。当面着手しない Cognitive Architecture 構想（`ai-integration.md`）と役目終了テンプレ、CLAUDE.md §9 と重複する README を削除し、主戦場となる Mobile 移植計画と Desktop 残課題メモを新設。CLAUDE.md の陳腐化参照も同時整理（341 行、400 行上限内）。主目的（Daily / Note / Schedule table の読み書き）は既存 MCP 30 ツールで充足済みという認識を文書化。

#### 変更点

- **vision/ 削除 3 件**: `ai-integration.md`（Cognitive Architecture 当面凍結）/ `2026-04-18-application-definition-template.md`（Phase A-2 役目終了）/ `README.md`（CLAUDE.md §9 と重複）
- **vision/coding-principles.md 改訂**: §5 Cognitive Architecture 節を削除、§6 更新フローが §5 に繰り上がり（§1-4 設計原則は不変）
- **vision/mobile-porting.md 新規**: Desktop → iOS 移植 + Cloud Sync 連携の主戦場ドキュメント。3 本柱（Daily / Note / Schedule）、範囲内 / Mobile 省略 6 Provider 範囲外、連携ハブ（Cloudflare Workers + D1）、次のアクション 4 件（iPhone シミュレータ検証 / Notes iOS 編集 / Sync 既知 Issue 解消 / 移植順ロードマップ）を明記
- **vision/desktop-followup.md 新規**: Desktop 残課題（Materials File タブ / Notes (Node) / Board）を短くメモ。新規大型機能は立てず、個別実装は別途 `.claude/YYYY-MM-DD-<slug>.md` で扱う方針
- **CLAUDE.md 参照整理**: §3.4 の `claude_*` テーブル言及削除 / §4.5 の `2026-04-17-daily-life-hub-requirements.md` 参照削除 / §5 の `ai-integration.md` リンク + §5.3 Cognitive Architecture 節削除 / §8 Tier 3 は Cognitive を「当面凍結」表記で維持（リンクなし）/ §8 末尾に次フェーズ計画リンク（mobile-porting / desktop-followup）追加 / §9 内 `coding-principles.md §6` → `§5` に調整
- **計画書**: `~/.claude/plans/vision-daily-note-schedule-table-mcp-ma-toasty-tower.md` はグローバルスキャッフォールド領域のため `.claude/archive/` 対象外

---

### 2026-04-19 - ディスク容量削減（life-editor 全体 12GB → 3.7GB / -69%）（計画書: 外部 `~/.claude/plans/life-editor-elegant-emerson.md`）

#### 概要

`life-editor/` 配下 12GB の容量分析を実施し、リスク別の段階的クリーンアップを実行。孤立ワークツリー（別プロジェクト残骸）+ Rust ビルドキャッシュ + 全 node_modules を除去しつつ iOS 関連データ（3.3GB）は保持。全削除操作を macOS ゴミ箱経由で行い復元可能性を担保。最終 3.7GB（-8.3GB）。

#### 変更点

- **容量分析**: 上位 13 カテゴリを計測。最大は `src-tauri/target` 9.6GB（全体 83%、Rust debug/release/iOS で依存クレート重複ビルド）。`.claude/worktrees/jovial-shannon` 886MB は `package.json: "sonic-flow"` / `electron/` 含む別プロジェクト残骸と判明（`git worktree list` 非登録）
- **孤立ワークツリー除去**: `.claude/worktrees/jovial-shannon` をゴミ箱へ → `git worktree prune -v` でメタデータ（`.git/worktrees/jovial-shannon`）も自動除去
- **Git オブジェクト圧縮**: `git gc`（`--prune=now` は harness に denied されたためデフォルト 2 週間 expiry で実行）。loose 5547 個・112MiB → pack 化、`.git` 117MB → 79MB
- **Rust ビルドキャッシュ除去**: `src-tauri/target/{debug, release}` をゴミ箱へ（合計 7.0GB）。**iOS ターゲット `target/aarch64-apple-ios` 2.7GB は保持**（ユーザー選択・近日 iOS 作業予定のため）
- **node_modules クリーンアップ**: 4 階層全 `node_modules`（root / frontend / cloud / mcp-server、合計 594MB）をゴミ箱へ → `frontend` と `mcp-server` のみ即 `npm install` で再導入、`cloud` と root は必要時に再インストール
- **Vite 出力除去**: `frontend/dist` 25MB をゴミ箱へ
- **削除方式**: 初回 `rm -rf` が harness に denied されたため `/usr/bin/trash` による macOS ゴミ箱移動に切替。全操作が復元可能状態
- **結果**: 12GB → 3.7GB（3.3GB = src-tauri / 292MB = frontend / 63MB = mcp-server / 残りは .git + .claude + resources 等）
- **副作用**: 次回 `cargo tauri dev` は初回フルビルド（約 10-20 分）を要する
- **再発防止メモ**: `.claude/worktrees/` と `git worktree list` の乖離を定期確認、Rust incremental キャッシュは月次 `cargo clean`、iOS 作業終了後は Level 3 クリーンアップで追加 3.3GB 削減可能

---

### 2026-04-19 - Mobile UI/UX 改善 第 2 弾（Calendar / Sheet / Routine Group / Note/Memo TipTap / ジッター軽減）

#### 概要

Mobile 版の UX 問題 9 件をユーザーフィードバックに沿って段階実装。第 1 弾で Schedule 全アイテム表示 / 3-mode bottom sheet / Routine グループ化 / Note・Memo の TipTap 化を実装し、第 2 弾で Daycell をチップ形式に戻し、Note/Memo 詳細の seed バグと月ナビゲーションバグを修正、新規スケジュール項目の memo 永続化、viewport 単位を `svh` に置換して iOS での pixel jitter を軽減。`tsc` 0 / `eslint` 0 / `vitest` 200/200 pass。

#### 変更点

- **Daycell 表示刷新 → 復元**: 第 1 段でドット表示に変更したが、ユーザー要望で**タイトル付きチップ + 最大 3 件 + `+N more`** のデスクトップ踏襲デザインに復元（`MobileEventChip.tsx` を再作成、`MobileDayDots.tsx` 削除）。セル幅超過時は ellipsis で切り詰め。全 item 種（tasks / events / routines）が対象で `buildMonthItemMap` を活用

- **Bottom Sheet 3-mode 化**: `MobileDaySheet.tsx` の `expanded: boolean` を `mode: "hidden" | "half" | "full"` に変更。half=38svh / full=70svh。drag down で段階的に縮小（full→half→hidden）、X ボタンで即時クローズ、ハンドルタップで half↔full トグル。full 時は上 30svh のカレンダーが見え Daycell タップで日付切替可能

- **Routine グループ UI**: `MobileDayflowGrid.tsx` を全面書き換え。`assignColumns()` で同時間帯アイテムのカラム分割（デスクトップ `ScheduleTimeGrid` のアルゴリズム移植）、タイトル ellipsis、デスクトップの `GroupFrame.tsx` を再利用してルーチングループを視覚化。`MobileDaySheet` にもグループ別 Accordion を追加（`ChevronDown` で開閉、グループ色で枠 + 背景着色）

- **Note/Memo TipTap 化**: `shared/MobileRichEditor.tsx` を新規作成（StarterKit + Placeholder、400ms debounce 自動保存、unmount / beforeunload で pending flush）。`MobileNoteView.tsx` / `MobileMemoView.tsx` の textarea を置換し保存ボタン削除。詳細画面は親で `key={selectedId|date}` を付けた keyed sub-component（`MobileNoteDetail` / `MobileMemoDetail`）に分離し、「初回選択で本文空表示」「2 回目に前回内容が表示される」 seed バグを解消

- **Calendar 月ナビゲーション修正**: `<` `>` ボタンで次月/前月へ遷移するバグ（viewDate を render 中に setState で上書きし元の月に戻る）を修正。`viewDate` state を `MobileCalendarView` 親に昇格し、`useEffect` で selectedDate 変更時のみ同期する形に変更。月データ fetch を viewDate ベースに切替。Search アイコンは将来実装まで非表示

- **新規スケジュール項目の memo 永続化**: `createScheduleItem` シグネチャに memo パラメータが存在しないため、create 直後に `updateScheduleItem({ memo })` を follow-up する形で保存（`MobileCalendarView.handleSave`）。既存 edit パスは変更なし

- **iOS pixel jitter 軽減**: `h-dvh` / `38dvh` / `70dvh` を全て `svh` (Small Viewport Height) に置換 —— `MobileLayout.tsx` / `MobileDaySheet.tsx` / `MobileCalendarView.tsx` (FAB) / `MobileWorkView.tsx`。加えて root に `overscroll-behavior: none` / main に `contain` を設定。URL バー・safe area 変動に伴う数 px の再計算を抑制

- **i18n**: `en.json` の `mobile.calendar.moreCount` を `"+{{count}}"` → `"+{{count}} more"` に更新（要件準拠）。ja は既存の `"+{{count}}件"` を維持

- **削除**: `MobileEventChip.tsx` を第 1 段で削除 → 第 2 段で再作成（同内容）。`MobileDayDots.tsx` は第 1 段で作成 → 第 2 段で削除

<!-- older entries archived to HISTORY-archive.md -->
