# MEMORY.md - タスクトラッカー

## 進行中

（なし）

## 直近の完了

- Memos → Daily 全層 rename + MemoEditor → RichTextEditor 中立分離 ✅（2026-04-23）— DB v63→v64 migration で `memos` → `dailies` リネーム（`memo-YYYY-MM-DD` → `daily-YYYY-MM-DD` の id 形式変換、`note_links.source_memo_date` → `source_daily_date` カラム rename、`wiki_tag_assignments` / `paper_nodes` の `entity_type='memo'` → `'daily'` 更新、既存データ保持）+ Rust backend 全層 rename（`memo_repository` / `memo_commands` → `daily_*`、12 IPC handler、`sync_engine` VERSIONED_TABLES、`SyncPayload.memos` → `.dailies`、`data_io_commands` / `diagnostics_commands` / `claude_commands` / `note_link_commands` / `copy_commands`）+ MCP Server（`get_memo` / `upsert_memo` → `get_daily` / `upsert_daily` の Hard break、`memoHandlers` → `dailyHandlers`、`contentHandlers` / `searchHandlers` / `wikiTagHandlers` の target/domain enum 更新）+ Frontend（`types/memo` → `daily`、Pattern A 3-file `DailyContextValue` / `DailyContext` / `useDailyContext` / `useDaily`、`DataService` + `TauriDataService` 12 メソッド rename、32 consumer 自動置換、`MobileMemoView` → `MobileDailyView` / `DailyMemoView` → `DailyView` / `MemoActivityHeatmap` → `DailyActivityHeatmap` / `MemoNodeComponent` → `DailyNodeComponent` / `memoGrouping` → `dailyGrouping`、`UndoDomain` / `ConversionSource` / `WikiTagEntityType` / `useWikiTagSync` / `useNoteLinkSync` の "memo" → "daily" 型更新、`memoId` / `memoDate` / `onDeleteMemoEntity` 等変数 rename、`McpToolsList.tsx` の tool name 文字列更新）+ Cloud Sync（`cloud/db/schema.sql` 更新 + `0002_rename_memos_to_dailies.sql` migration 新規 + `cloud/src/routes/sync.ts` VERSIONED_TABLES / PRIMARY_KEYS）+ i18n（`mobile.tabs.memos` → `mobile.tabs.daily`、`mobile.memo.*` → `mobile.daily.*`、en: "Daily" / ja: "日記" 統一）+ MemoEditor TipTap（589 行）を `components/shared/RichTextEditor.tsx` に移動＋改名し汎用エディタとして再配置、6 consumers の import path を 2 levels 調整、`LazyMemoEditor` → `LazyRichTextEditor` + CLAUDE.md §2/§4.1-4.4/§5.1/§6.2/§8 を全面更新。検証: cargo test 11/11（V64 migration test 新規追加で data 変換・note_links column rename・wiki_tag_assignments 更新を検証）/ cargo build --release 成功 / Vitest 231 pass / Frontend `npm run build` 成功 / MCP `npm run build` 成功。`time_memos` テーブルは別概念のため本 rename から意図的に除外
- TaskTree + Folder DetailPanel ヘッダー簡素化 ✅（2026-04-23）— TaskTree フォルダ行が `node.icon` に追従 / Folder DetailPanel のアイコンピッカーをタイトル左横にインライン統合 / Task DetailPanel の「Move to folder」機能と `FolderMovePicker.tsx` を完全廃止 / Complete フォルダ選択時の展開ドロップダウン + DONE 一覧表示。`FOLDER_MOVE_CONFIRM_SKIP` storage key 削除。Vitest 231 pass / tsc -b 編集 4 ファイル 0 error
- Routine schedule_items 重複の根本修正 + Cloud sync initial-pull 500 件 cap 暫定対応(Known Issues 011 / 012)✅（2026-04-22）— 4 層欠陥(DB UNIQUE 制約欠落 / sync 衝突解決が id 単独 / Frontend Map キー単独 / Rust `create()` ガード欠如)を `V63` migration + create() ガード + sync_engine 特別扱い + Cloud Worker pre-dedup + 複合キー `${routineId}:${date}` で根治。Cloud D1 既存 1,181 行を DELETE、partial UNIQUE index を SQLite/D1 両端に張り恒久化。Known Issue 012 を LIMIT=5000 bump で暫定対応

## 予定

### Known Issue 012 本命修正 — sync pagination 実装

**対象**: `cloud/src/routes/sync.ts` / `src-tauri/src/sync/sync_engine.rs` / `src-tauri/src/sync/sync_client.rs` / `src-tauri/src/sync/types.rs`
**背景**: `/sync/changes` が `hasMore: true` を返しても Rust client が無視して一度で完了扱い。現在は LIMIT=5000 の bump で暫定凌ぎだが、テーブルあたり 5000 行を超えるとまた同じ truncate が再発する構造的バグ。
**手順**: Worker 側に `nextSince` cursor を含めて返すよう改修 → client で `while has_more { fetch_changes(since=nextSince) ... }` ループを実装 → `last_synced_at` は全ページ完了後に確定更新
**参照**: `.claude/docs/known-issues/012-sync-changes-limit-500-truncates-large-initial-pull.md`

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

### Frontend 既存 lint 116 問題の一括解消

**対象**: `useTaskTreeCRUD.ts` / `databaseFilter.ts` / `holidays.ts` 他(session 外で蓄積)
**背景**: 2026-04-22 session-verifier で検出。Unused underscore-prefixed vars / React Compiler memoization 不整合 / exhaustive-deps missing が混在。本 session の変更範囲外のため touching 見送り、別セッションで一括対応

### 保留（将来再評価）

- **S-2**: Tauri IPC naming 方針 — ADR-0006 で規約のみ採択、150 コマンド一括 typed struct 移行は未着手
- **React Compiler 有効化**: S-4 Drop 判定時に切り離し

## バグの温床 / 今後の注意点(2026-04-22 時点)

以下は本 session で顕在化した構造的な脆弱性。同類のバグが再発する可能性が高い領域として記録:

- **論理的一意性を持つテーブルの UNIQUE 制約**: schedule_items で発覚したが、tasks / memos / notes / routines も同じ「`id` PK のみで論理キー UNIQUE 無し」。特に `routine_tag_assignments (routine_id, tag_id)` のような複合キー relation は要再点検
- **sync 衝突解決が ID 単独**: `ON CONFLICT(id)` + version 比較の LWW は複合キー衝突(異 id 同 payload)を検知できない。今回は schedule_items に特別扱いを足したが、他の relation テーブルが同じ罠に嵌る可能性
- **pagination 半実装**: `/sync/changes` の LIMIT + `hasMore` は cursor が伴わず、client ループにも対応していない。暫定 LIMIT=5000 は応急措置で、テーブル成長で再発
- **client / server 分散 flag**: `has_more` のように片方だけが使っている field は気づかず古びていく。片側更新時はもう片側の参照箇所を grep で確認する運用が必要
- **Mobile UI の機能欠落(Full Re-sync)**: Desktop SyncSettings と Mobile MobileSyncSection で実装差分があり、障害時の workaround が Mobile で取れない
- **`tsc --noEmit` at frontend root は無意味**: `tsconfig.json` が solution-style(`files: []` + references のみ)なので実際の型チェックが走らない。Phase 0 verification では `tsc -b` または `npm run build` を使うべき(session-verifier skill には記録済)
- **Xcode GUI ⌘R は Tauri 2.x で動かない**: `cargo tauri ios xcode-script` は親プロセスが立てる JSON-RPC サーバに依存。Xcode 単独起動では `ConnectionRefused` で落ちる。必ず `cargo tauri ios build` or `dev --host` をターミナルから実行
- **Xcode の PATH に NVM / cargo が無い**: `/usr/local/bin/` への symlink(cargo/rustc/rustup)で解消済だが、他のマシンでセットアップする際に再発する。`ios-everywhere-sync.md` vision 更新案件
- **Desktop パッケージ版と HEAD 実装の乖離**: V64 migration は DB に適用される必要あり、`/Applications/Life Editor.app` の Rust バイナリは旧版のままだと Daily テーブル未対応で起動時 migration 走行 → dailies への rename を経験する。新規ビルドを置換推奨
- **Cloud D1 migration 未適用**: `cloud/db/migrations/0002_rename_memos_to_dailies.sql` は新規追加済みだが D1 本番への wrangler 実行は未実施。Desktop/iOS app の V64 デプロイと協調して `wrangler d1 execute life-editor --file=cloud/db/migrations/0002_rename_memos_to_dailies.sql` を実行する必要あり
