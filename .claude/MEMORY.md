# MEMORY.md - タスクトラッカー

## 進行中

（なし）

## 直近の完了

- リファクタリング計画 Phase 2-2/2-3b/2-3c/2-3d/3-2/3-3/3-5 集中実施 ✅（2026-04-26）— ユーザー要望「2026-04-25-refactoring-plan.md の未完了タスクを完了させて」を Auto mode で 1 セッション内に対応。完了 7 Phase: **Phase 2-2** (`0f49dc5`) TauriDataService 1502→52 行 + 19 ドメインモジュール (`services/data/{tasks,timer,sound,daily,notes,calendars,routines,scheduleItems,playlists,wikiTags,timeMemos,paper,databases,files,sidebar,system,templates,sync,misc}.ts`)。session-verifier 検出後 class 撤去 → `tauriDataService` const singleton 化 (`8149fd6`) で declaration merging 解消。**Phase 2-3b** (`b3e7a21`) ScheduleTimeGrid 1221→926 行 + `scheduleTimeGridLayout.ts` (326 行) に純粋ロジック 5 関数 + 型 + 定数を抽出。**Phase 2-3c** (`70b7b14`) OneDaySchedule 1276→1172 行 + `useDayFlowFilters.ts` (97 行) + `useDayFlowDialogs.ts` (223 行) + `dayFlowFilters.ts` (16 行)。**Phase 2-3d** (`865cc77`) TagGraphView 1443→1414 行 + `tagGraphStorage.ts` (45 行) に localStorage helpers 抽出。**Phase 3-3** (`550e55f`) `components/Schedule/` → `components/ScheduleList/` rename (13 ファイル + 外部 import 4 箇所更新)。**Phase 3-2** (`62d144f`) cursor pagination 本実装 (Issue #012): server `pullVersionedDelta` が `nextSince` 返却 + client `sync_trigger` を `loop { fetch_changes; if !has_more break; cursor = next_since }` ループ化、`sync_last_synced_at` は全 page 完了後にのみ永続化、3-way break ガードで無限ループ防止、旧サーバ互換 (`#[serde(default)]`)。**Phase 3-5** (`7645d2d`) UNIQUE 制約 audit: 全 relation テーブルが既に PRIMARY KEY 複合キー or UNIQUE 制約あり、Plan の前提が古かったと判明 → migration 追加不要。**session-verifier (`8149fd6`)**: TauriDataService class→const + OneDaySchedule useCallback deps に `setRoutinePicker`/`setNotePicker` 4 箇所追加 + 新規テスト 36 件 (scheduleTimeGridLayout 19 / tagGraphStorage 9 / useDayFlowFilters 8)。**検証**: tsc -b 0 / vitest 39 files 324 passed (前回 288 + 新規 36) / cloud tsc clean / cargo build & test clean / lint 私の変更行で新規 0 (残 114 problems は既存) / 全 6 ゲート PASS。**見送り** (本セッション): Phase 2-4 (Calendar 統合、UI 検証必須) / Phase 3-1 (27 ファイル trait 化、Plan 自身も "6-10 セッション" 想定) / Phase 3-4 (Schedule View 統合、UI 検証必須)。**残課題**: Worker deploy 必須 (Phase 3-2 server 側) / 手動 UI 検証 / 計画書は IN_PROGRESS のため archive せず継続
- WikiTag カラーピッカー文字色/プリセット即閉鎖バグ + ネスト枠 UI 修正 ✅（2026-04-26）— ユーザー報告: WikiTag (TipTap inline / WikiTagList chip) の編集パネルでカラーピッカーのプリセット色 / 文字色タブをクリックすると色が変わらず即パネルが閉じる + ピッカーの幅が固定 (190px) で WikiTag 編集パネル (208px) と合わず二重枠の不格好 UI。**真因 (バグ)**: `WikiTagList.tsx` / `WikiTagView.tsx` の編集パネル上部入力 `<input autoFocus>` が `onBlur` で `handleEditSave` → `setEditing(false)` を呼ぶ。macOS WebKit では `<button>` クリックで focus が button に移らず `e.relatedTarget = null`、`editRef.current.contains(null)` が false → 即 save → panel 閉じる → click event は to なし。**修正**: (1) `frontend/src/components/shared/UnifiedColorPicker.tsx` の全 interactive ボタン (Background/Text タブ・12 プリセット色・Default リセット) に `onMouseDown={(e) => e.preventDefault()}` 追加で input blur 阻止 / (2) `embedded?: boolean` prop 追加 — `inline + embedded` 時は picker 自身の border/bg/shadow/`w-[190px]` 固定幅を捨て `w-full` で親コンテナいっぱいに伸長、(3) preset grid に `justify-items-center` 追加で伸長時の見た目調整、(4) `WikiTagList.tsx` / `WikiTagView.tsx` で `embedded` を渡し WikiTag 編集パネルの二重枠解消。**新規テスト**: `UnifiedColorPicker.test.tsx` 4 件 (onChange 発火 / preset mousedown preventDefault / Default リセット mousedown preventDefault / embedded 切替で wrapper class 変化)。**検証**: tsc -b 0 error / vitest 35 files 284→288 tests 0 failed / 私の変更行で新規 lint エラー 0 (WikiTagList.tsx:68 `Math.random` purity 警告は既存コード d9ebdff0 由来、未触の handleCreate イベントハンドラ false positive 寄り) / session-verifier 全 6 ゲート PASS。**残課題**: 手動 UI 検証 (a) note 内 inline WikiTag をクリック → 編集ポップアップでプリセット色/Background/Text タブ/Default ボタン全てクリックで panel 開いたまま色変化 / (b) WikiTagList chip 同様 / (c) ピッカーが panel 幅いっぱいに広がり二重枠が消える
- UnifiedColorPicker 共通化 + UI 透明度ポリシー策定 + Routine UI 群修正 ✅（2026-04-25）— ユーザー要望ベースの一連の UI/UX クリーンアップ。**Routine UI 4 件**: (1) Edit group panel から frequency "Group" を非表示（`FrequencySelector` に `hideGroupOption` prop 追加、`RoutineGroupEditDialog` で渡す）/ (2) Calendar 右サイドバーの検索アイコン + フォルダフィルタを横並び化（`ScheduleSidebarContent` の縦並び 2 ブロックを flex 1 ブロックに統合）/ (3) Dayflow Timegrid アイテム右クリック削除時の `NaN left CSS` 修正（`onRequestRoutineDelete` シグネチャを `{}` empty event から `position: { x, y }` ベースに変更、4 ファイルで `contextMenu.position` / `schedulePreview.position` / `e.clientX/Y` を渡す）/ (4) Schedule Tags ラベル + 新規追加インライン UI のはみ出し（`min-w-0` + `shrink-0`）。**Routine 削除 ErrorBoundary クラッシュの真因修正**: Rust `Result<()>` vs TS `Promise<ScheduleItem[]>` の戻り値型不一致 → `await bulkCreate()` undefined → Spread エラーで `ScheduleItemsProvider` がクラッシュ。`DataService` / `TauriDataService` を `Promise<void>` に揃え、`useScheduleItemsRoutineSync.ts` / `useDayFlowColumn.ts` で `toCreate` からローカルで `ScheduleItem[]` を組み立てる方式に変更。**カラーピッカー共通化**: `UnifiedColorPicker.tsx` を全面書き換え（`react-colorful HexColorPicker` 撤去 → preset 12 色 6 列 × 2 行 + native input[type=color] + showTextColor 時の Bg/Text タブ）。Mac 標準コンパクト感（w-[190px] / w-6 + gap-1.5）+ `bg-notion-bg-popover` (CSS 変数未定義の透明落ち) → `bg-notion-bg`。API 完全互換で利用 12 箇所は変更不要。**UI 透明度ポリシー策定**: `vision/coding-principles.md §5` 新設（規約・例外・禁止例・修正パターン・検出 grep）+ `CLAUDE.md §6.4` 追記で auto-load。透明 UI 5 箇所修正（`SidebarLinkItem` 3点メニュー / `CalendarTagSelector` / `CalendarTagsPanel` Rename/Delete / `FreeSessionSaveDialog` 親タスク検索 / `TipsPanel` を `bg-notion-bg-secondary/70 backdrop-blur-sm` → `bg-notion-bg-secondary`）。**検証**: tsc -b 0 error / vitest 35 files / 284 tests / 0 failed / lint 私の変更行で新規エラー 0 / session-verifier 全 6 ゲート PASS。**残課題**: D1 migration 0007 + Worker deploy（前セッション残）/ 手動 UI 検証 / Ideas ロックオーバーレイの透明度（ScreenLock 機能で意図的、放置）/ MiniTodayFlow / Toast の `bg-white/XX` ホバーの notion-hover 統一余地

## 予定

### Routine Tag 廃止 + Group 化 の手動 UI 検証 + Cloud D1 0007 適用 + Worker deploy

**対象**: Desktop V69 自動 apply / Routine 編集 UI / Cloud Sync 双方向伝搬
**前提**: V69 + D1 0007 のコードは着地済 (本セッション完了)、本番 D1 / Worker は未反映
**手順**:

1. **Cloud D1 0007 適用**: `cd cloud && npx wrangler d1 execute life-editor-sync --remote --file=./db/migrations/0007_drop_routine_tags_add_group_assignments.sql`（migration FIRST）
2. **Worker deploy**: `cd cloud && npm run deploy`（migration 適用後）
3. **Desktop V69 自動 apply 確認**: `sqlite3 ~/Library/Application\ Support/life-editor/life-editor.db "PRAGMA user_version"` が 69 / `routine_tag_definitions` / `routine_tag_assignments` / `routine_group_tag_assignments` が消失 / `routine_group_assignments` 新設
4. **Routine UI 検証**: 既存 Routine が Tag 表示なしで描画 / `RoutineEditDialog` の frequencyType に "Group" 追加 / Group 選択時に既存 Group 多重選択 + 「+ 新規 Group 作成」inline form / 作成成功で自動選択 / 保存後カレンダーに正しく出現
5. **Cloud Sync 双方向**: Desktop で Group 紐付け変更 → iOS に伝搬 / 逆方向も同様 / soft-delete 復活も伝搬

### ユーザー並行作業の TS エラー解消（別コミット）

**対象**: `App.tsx` / `CommandPalette.tsx` / `Schedule/ScheduleSection.tsx` / `Settings.tsx` / `Ideas/{Connect,Paper,Daily,Materials}Sidebar.tsx` / `useAppCommands.ts` / `useSectionCommands.ts` / 新規 `SearchTrigger.tsx` / `lucideIconRegistry.ts`
**背景**: 本セッションの Routine Tag→Group 移行とは独立して進行している検索トリガー refactor 由来の TS エラー: `sidebarSearchQuery is not defined` (ScheduleSection.tsx) / TS6133 unused vars 多数 / `searchPlaceholder` props 不整合
**手順**: 検索トリガーの refactor を一旦完成させ tsc -b clean に戻す → コミット

### Q2 機能パッチ Phase D / Phase A Cloud Sync の手動 UI 検証

**対象**: macOS app launch / 既定ブラウザ選択 / iOS Drawer 表示 / 双方向同期の動作確認
**前提**: D1 migration 0003/0004/0005/0006 全適用済 + Worker latest deploy 済 (2026-04-25 完了)
**手順**:

1. Desktop で Sync Now 実走 → `Last error` が消えて Connected 表示が維持されることを確認
2. Desktop V67 自動 apply 確認 → LeftSidebar に「Links」セクション表示 / `+` で URL/App リンク追加 / 既定ブラウザ切替で URL 起動先が変わる / `/Applications/*.app` 一覧から登録できる
3. iOS シミュレータ Drawer に `kind='app'` がグレーアウト + Toast 出ることを確認
4. Desktop ↔ iOS 双方向 sync で sidebar_links と calendar_tag_assignments が伝搬すること
5. **Known Issue 016 検討**: D1 0004 が transactional rollback 保証下にも関わらず `calendar_tag_assignments` rebuild 部分のみ未適用となった原因の調査・記録 (`docs/known-issues/_TEMPLATE.md` から起票)

### リファクタリング計画 残 Phase（Phase 2-2/2-3a-d/3-2/3-3/3-5 完了、IN_PROGRESS）

**対象**: 巨大 React コンポーネント Mobile/Desktop 統合 / Rust repository trait 化
**計画書**: `.claude/2026-04-25-refactoring-plan.md`（IN_PROGRESS のため未 archive）
**残 Phase（推定 12-18 セッション）**:

- **Phase 2-4 Calendar Mobile/Desktop 統合**: `CalendarView.tsx` (1168 行、month/week 両モード) と `MobileCalendarView.tsx` (823 行、独自 UI) の差分を `useCalendarViewLogic` + `components/Calendar/shared/{MonthGrid,DayCell,EventBadge}` に集約。**Plan 自身が iOS 実機テスト必須と明記**、手動 UI 検証なしには regression 不可避
- **Phase 3-1 Rust row_to_model RowConverter trait** (推定 -1500 行 / 6-10 セッション): 27 repository の個別 `row_to_*` fn を `impl RowConverter for X` trait impl に移行。各 repo に微妙な差異 (joins / JSON serialize / snake↔camel) があり機械的置換不可、段階的に推奨
- **Phase 3-4 Mobile/Desktop Schedule View 統合**: `ScheduleSection.tsx` (750) と `MobileScheduleView.tsx` (489) を `useScheduleViewLogic` + shared component で。Phase 2-4 と同じ UI 検証問題のため別セッション

**完了済み**: Phase 0 (Quick Wins) / Phase 1 (sync.ts 分割 + Provider tree + row_converter + SQL whitelist) / Phase 2-1 (migrations 分割) / Phase 2-2 (TauriDataService 19 ドメイン) / Phase 2-3a-d (TaskDetailPanel / ScheduleTimeGrid / OneDaySchedule / TagGraphView) / Phase 3-2 (cursor pagination) / Phase 3-3 (Schedule→ScheduleList rename) / Phase 3-5 (UNIQUE 制約 audit、追加不要と確認)

### Realtime Sync Phase 1 実装 — foreground 可変 polling + 変更イベント駆動 push

**対象**: `frontend/src/context/SyncContext.tsx` / DataService mutation 呼出層
**背景**: 現状 30 秒間隔 polling で往復 60 秒ラグ。「DB 共有の実感」が薄い
**手順**: Visibility API 観測 → フォアグラウンド 3-5s / 非アクティブ 60s、主要 mutation 後に debounced `triggerSync()`
**参照**: `.claude/docs/vision/realtime-sync.md` Phase 1

### Mobile Settings に Full Re-sync ボタン追加

**対象**: `frontend/src/components/Mobile/MobileSettingsView.tsx::MobileSyncSection` (line 159-183)
**背景**: Desktop `SyncSettings.tsx` には `fullDownload` ボタンがあるが Mobile 側は `triggerSync` + `disconnect` の 2 ボタンのみ。初回 pull が truncate した時に「Disconnect → Reconnect」の 3 手順が必要で UX が悪い

### Desktop パッケージ版の更新

**対象**: `/Applications/Life Editor.app`
**背景**: 現在の /Applications 配下は session 前の Rust バイナリ(V63 migration / create() guard / sync_engine 特別扱いを含まない)。V63 は DB に既適用済なので実害は限定的だが、新規 Routine 作成時の (routine_id, date) UNIQUE 違反を graceful に握りつぶす guard が無い
**手順**: `cargo tauri build` → `target/release/bundle/macos/Life Editor.app` を `/Applications/` 既存と置換

### Part A 手動受入テスト（iOS 実機）

**対象**: iPhone 実機での Materials Notes 表示確認
**背景**: 2026-04-21 Phase A コード変更は品質ゲート通過済み、iOS 実機での NodeView レンダリング確認が未実施
**観点**: Callout / ToggleList / WikiTag / NoteLink / Table / TaskList が Desktop と同一構造で表示されること

### Cloud Sync データ復旧作業（タグ情報 iOS → Desktop）

**対象**: iOS / Desktop の `routine_tag_assignments` 復旧
**背景**: 008 修正コードは着地したが、Desktop の `routine_tag_assignments` は空のまま。iOS の正データを Cloud 経由で取り戻す必要あり。2026-04-22 の iOS 再接続 + Sync Now で一部は復旧している可能性、要確認

### iOS 4G 同期検証

**対象**: iPhone 実機 / 4G 環境
**前提**: 004/005/008 修正完了 + V62 migration 適用 + タグ復旧完了

### Mobile Schedule & Work リデザイン 手動 UI 検証

**対象**: iPhone シミュレータ / Tauri build で Schedule 月カレンダー / Dayflow / Work 全項目を目視検証

### iOS 追加機能要件の残タスク（Phase 4 M-1 / Phase 5 / Phase 6.2 / Mobile C-3）

**対象**: `NoteTreeNode` (行スワイプ) / `components/Notes/extensions/SlashCommand.ts` (新規) / `MobileCalendarView` の filter UI / `MobileScheduleItemForm` (5-role 対応)
**背景**: 2026-04-24 Phase 8 完了時点で以下を次セッションに繰越:

- **M-1 行スワイプ (edit / pin / delete)**: 既存 `NoteTreeNode` が DnD + hover UI を抱えるため touch-UX 再設計が必要
- **M-2 / M-3 TipTap slash command + empty line hint**: `@tiptap/suggestion` 依存追加 + ポップオーバー UI 新規実装
- **C-2 Calendar filter / sort**: role multi-select + sort UI 設計が必要（drawer 内 filter sheet として実装予定）
- **Mobile C-3**: `MobileScheduleItemForm` を event 専用から 5-role 選択対応にリファクタ

**参照**: `~/.claude/plans/life-editor-note-ios-calm-moth.md` Phase 4-6

### Frontend 既存 lint 116 問題の一括解消

**対象**: `useTaskTreeCRUD.ts` / `databaseFilter.ts` / `holidays.ts` 他(session 外で蓄積)
**背景**: 2026-04-22 session-verifier で検出。Unused underscore-prefixed vars / React Compiler memoization 不整合 / exhaustive-deps missing が混在。本 session の変更範囲外のため touching 見送り、別セッションで一括対応

### 保留（将来再評価）

- **S-2**: Tauri IPC naming 方針 — ADR-0006 で規約のみ採択、150 コマンド一括 typed struct 移行は未着手
- **React Compiler 有効化**: S-4 Drop 判定時に切り離し

## バグの温床 / 今後の注意点(2026-04-23 更新)

以下は本 session で顕在化した構造的な脆弱性。同類のバグが再発する可能性が高い領域として記録。DB 系の再発防止ルールは [`docs/vision/db-conventions.md`](./docs/vision/db-conventions.md) に集約:

- **timestamp 形式混在（Known Issue 013）**: SQL 内 `datetime('now')` と `new Date().toISOString()` / `helpers::now()` が同じテーブルに書き込まれ、スペース区切り vs ISO 8601 の混在で sync 文字列比較が壊れる。ASCII 順 space(0x20) < T(0x54) のため一度 since が ISO になると同日 space 行が永久に push から漏れる。暫定対応は sync query の `datetime()` 正規化、恒久対応は書き込み側を ISO 8601 に統一
- **delta sync が updated_at 単調性に依存（Known Issue 014）**: Mobile 11:50 編集 v=372 と Desktop 13:30 編集 v=228 のような高 version + 古 updated_at が Cloud に居座ると `WHERE updated_at > since` では永久に pull されない。Full Re-sync が緊急弁。本命は Cloud D1 に `server_updated_at` 列を追加して delta cursor をそちらへ切り替え
- **Cloud D1 migration が Desktop migration と同一テーブル前提になりがち**: 0002 を流用しようとしたら `note_links` / `paper_nodes` が D1 に無く失敗。Desktop schema は superset、Cloud は subset という認識を migration 作成時に徹底
- **Cloud deploy と D1 migration の tai-ming**: Worker を deploy すると新 schema を前提に push INSERT を試み、D1 が未 migration だと batch 全ロールバック → sync 全体が silent に停止。deploy と migration を必ずセットで運用
- **論理的一意性を持つテーブルの UNIQUE 制約**: schedule_items で発覚したが、tasks / dailies / notes / routines も同じ「`id` PK のみで論理キー UNIQUE 無し」。特に `routine_tag_assignments (routine_id, tag_id)` のような複合キー relation は要再点検
- **sync 衝突解決が ID 単独**: `ON CONFLICT(id)` + version 比較の LWW は複合キー衝突(異 id 同 payload)を検知できない。今回は schedule_items に特別扱いを足したが、他の relation テーブルが同じ罠に嵌る可能性
- **pagination 半実装**: `/sync/changes` の LIMIT + `hasMore` は cursor が伴わず、client ループにも対応していない。暫定 LIMIT=5000 は応急措置で、テーブル成長で再発
- **D1 の compound SELECT 制限**: `UNION ALL` は 5 本まで。診断 SQL で 6 本以上繋ぐと `too many terms` エラー。個別 `--command` で回す
- **wrangler d1 execute の引数**: 相対パスは CWD 基準 / 長いコマンドを `\` で改行するとシェルによっては `--file=` 以降が別コマンド扱いで Unknown argument。1 行で書くのが確実
- **client / server 分散 flag**: `has_more` のように片方だけが使っている field は気づかず古びていく。片側更新時はもう片側の参照箇所を grep で確認する運用が必要
- **Mobile UI の機能欠落(Full Re-sync)**: Desktop SyncSettings と Mobile MobileSyncSection で実装差分があり、障害時の workaround が Mobile で取れない。014 のような状況で詰む
- **`tsc --noEmit` at frontend root は無意味**: `tsconfig.json` が solution-style(`files: []` + references のみ)なので実際の型チェックが走らない。Phase 0 verification では `tsc -b` または `npm run build` を使うべき(session-verifier skill には記録済)
- **Xcode GUI ⌘R は Tauri 2.x で動かない**: `cargo tauri ios xcode-script` は親プロセスが立てる JSON-RPC サーバに依存。Xcode 単独起動では `ConnectionRefused` で落ちる。必ず `cargo tauri ios build` or `dev --host` をターミナルから実行
- **Xcode の PATH に NVM / cargo が無い**: `/usr/local/bin/` への symlink(cargo/rustc/rustup)で解消済だが、他のマシンでセットアップする際に再発する。`ios-everywhere-sync.md` vision 更新案件
- **Desktop パッケージ版と HEAD 実装の乖離**: V64 migration は DB に適用される必要あり、`/Applications/Life Editor.app` の Rust バイナリは旧版のままだと Daily テーブル未対応で起動時 migration 走行 → dailies への rename を経験する。新規ビルドを置換推奨
- **iOS binary と Cloud schema の三者不整合**: Desktop / iOS / Cloud のどれか 1 つでも古いまま運用すると sync が silent に壊れる。V64 のような rename 系 migration は 3 端末同時更新が前提
