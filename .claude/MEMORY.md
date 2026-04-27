# MEMORY.md - タスクトラッカー

## 進行中

（なし）

## 直近の完了

- Header にアプリリロードボタン追加 + Connect アイコンを Lightbulb → Merge ✅（2026-04-27）— ユーザー要望「(1) アプリ全体リロード機能が不完全 + リロードアイコンが無いので、Header の Terminal/Undo/Redo/rightSidebar が並ぶ場所の Redo の左に配置 / (2) Connect の電球アイコンを mergeアイコンに変えて『繋ぐ』を視覚化」を Auto mode で実装。実装プランなしの小規模 UI 調整。**変更**: (1) `shared/UndoRedo/UndoRedoButtons.tsx` に `middleSlot?: ReactNode` prop を追加（Mobile usage は無指定で後方互換）、Undo と Redo の間に slot を render / (2) `Layout/TitleBar.tsx` で `RefreshCw` icon の reload ボタンを生成 (`window.location.reload()` 呼出、`text-notion-text-secondary hover:text-notion-text hover:bg-notion-hover` トークン使用)、`<UndoRedoButtons middleSlot={reloadButton} />` で渡す。section domains 無し時のフォールバック分岐にも reload ボタンを描画 / (3) `Layout/LeftSidebar.tsx` の `mainMenuItems` で connect の icon を `Lightbulb` → `Merge`（lucide-react、Y 字合流形状）。同ファイル下部の Tips ボタンの Lightbulb は意図的に維持 / (4) i18n: `common.reloadApp` キーを en.json (`"Reload application"`) / ja.json (`"アプリを再読み込み"`) 双方に追加。**Verification**: `tsc -b` 0 / `npm run test src/components/shared/UndoRedo` 8/8 pass / `npx eslint <変更3ファイル>` 0 / session-verifier 全 6 ゲート PASS
- 時間帯選択 UI を TimeDropdown に統一（Routine / RoutineGroup / EventDetail / ReminderSettings / MobileScheduleItemForm）✅（2026-04-27）— ユーザー要望「Routine/RoutineGroup の時間帯選択をドロップダウン化。Tasks 系で既に整っている UI/UX (`shared/TimeDropdown`) を再利用、その他の時間調整 UI も全て置き換え」を Auto mode で実施。実装プランなし。**統一ターゲット**: 5 ファイル / 11 箇所 — `RoutineEditDialog` (TimeInput x2 → TimeDropdown, minuteStep=1) / `RoutineGroupEditDialog` (TimeInput x4 → TimeDropdown, minuteStep=5, size=sm) / `ScheduleList/EventDetailPanel` (TimeInput x2 → TimeDropdown, minuteStep=5, size=sm) / `Settings/ReminderSettings` (`<input type="time">` → TimeDropdown, minuteStep=15) / `Mobile/MobileScheduleItemForm` (`<input type="time">` x2 → TimeDropdown, w-full justify-center, minuteStep=5)。**API互換性**: TimeDropdown と既存 TimeInput の props (`hour, minute, onChange(h, m), minuteStep, size, className`) が完全一致のため Routine 系/EventDetail はコンポーネント名置換のみで完了 (新規共通コンポーネント不要)。**`shared/TimeInput.tsx` 削除** (231 行、callers 0)。**Mobile className 注意**: tailwind-merge 未使用のため `bg-notion-bg-secondary` override は JIT 出力順依存で不安定 → デフォルト `bg-notion-bg` のまま運用 (date input と僅かに色違いだがドロップダウンパネル本体とは一致)。**Verification**: tsc -b 0 / vitest 42 files / 376/376 pass / session-verifier 全 6 ゲート PASS (`MobileScheduleItemForm` useEffect の `react-hooks/set-state-in-effect` は git stash で pre-existing と確認、本セッション無関与)
- Connect/Board の React Flow #008 警告解消 + Node/Board パフォーマンス改善 ✅（2026-04-26）— ユーザー報告 3 件 (#008 警告 / Connect モード接続不可 / Node・Board のもっさり) を Auto mode で 1 セッション完遂。実装プランなしのアドホック修正群。**警告 #008**: PaperCard/Text Handle に同じ id で source/target を重ねた **bidirectional Handle** 化、DB 自己ループ edge (`top-target`→`left-target`) でも `.source` lookup が成立。**Connect モード接続不可**: NoteNode/DailyNode のハンドルを `0×0` → `16×16` に拡張、`pointer-events` を `.tag-graph-connect-mode` 配下のみ `auto` に scope。**パフォーマンス**: (1) `usePaperBoard` の `deleteNode`/`deleteEdge`/`duplicateNode`/`toggleNodeHidden` を `nodesRef`/`edgesRef` 経由化し identity 安定化 + `useLayoutEffect` で ref 同期 (lint `react-hooks/refs` 違反解消)、(2) PaperCanvasView の edge data を `useMemo` 共有、(3) PaperCardNode が `useNoteContext`/`useDailyContext` を直接購読 (無関係ノート編集の全カード rebuild 解消)、(4) `TagGraphSelectionContext` 新設で highlighted/dimmed をノード内算出 (クリック時の全ノード rebuild 解消)、(5) `tagsById`/`noteEntityIdsByTag` Map 導入で O(A×T) → O(A) 化、(6) **新規 `reactFlowMerge.ts`** で `mergeNodes`/`mergeEdges` 差分マージ — drag stop 後の往復で identity 維持し React Flow 全 diff を回避。新規テスト 17 件。**Verification**: tsc -b 0 / vitest 42 files 376/376 / session-verifier 全 6 ゲート PASS。**残**: 手動 UI 検証 (要 dev server 完全再起動 + Cmd+Shift+R、React Flow `node.internals.handleBounds` キャッシュ刷新のため)

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

### リファクタリング Phase 2-4 / 3-1 / 3-4 検証用実装計画の手動実施

**対象**: Desktop / iOS 実機での UI 回帰検証 + Cloud Sync round-trip
**計画書**: `.claude/2026-04-26-refactoring-verification-plan.md` (Status: AUTOMATED COMPLETE / MANUAL PENDING)
**前提**: 自動検証 (S-1 Rust build/test / S-7 calendarGrid 境界ケース 20/20 / S-8 fetch_tree benchmark 100ms 基準内 / S-9 plan ファイル反映) は 2026-04-26 完遂済。残るは手動 UI / Cloud Sync / docs 整理のみ
**手順**:

1. **S-2 IPC 統合**: Desktop 起動 → Tasks / Notes / Dailies / Schedule / Routines / Database / Wiki Tags / Paper Boards / Sound / Templates / Sidebar Links 全 11 ドメインの fetch 経路でエラー無し
2. **S-3 Cloud Sync round-trip**: 5 ドメイン変更 → push → 別端末 pull → 完走 + 5000 行超で `nextSince` cursor 進行確認
3. **S-4 Calendar Mobile**: Monday 始まり / 月遷移スワイプ / chip 表示 / Today ハイライト / 月境界 item
4. **S-5 Calendar Desktop**: Sunday 始まり / 6 行固定 / WeeklyTimeGrid / DayCell 描画 / Routine ハイライト
5. **S-6 Schedule View**: MobileScheduleView 週 dots / 週遷移 (`getMondayOf` 基準) / 月跨ぎラベル / Desktop ScheduleSection 4 タブ / DualColumn toggle
6. **S-9 docs 整理 (UI 検証完了後)**: `docs/known-issues/INDEX.md` で formatter / SQL whitelist / row_to_model 重複 を削除候補マーク / `docs/code-inventory.md` の Active/Duplicate セクション更新

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
