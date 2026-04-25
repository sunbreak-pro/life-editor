# MEMORY.md - タスクトラッカー

## 進行中

（なし）

## 直近の完了

- リファクタリング Phase 2-3a TaskDetailPanel 分割完了 ✅（2026-04-25）— Phase 2 の最初の巨大コンポーネント分割。`TaskDetailPanel.tsx` 947→55 行、sibling 構造で 4 ファイル抽出（`InlineEditableHeading.tsx` 76 / `DebouncedTextarea.tsx` 62 / `TaskSidebarContent.tsx` 244 / `FolderSidebarContent.tsx` 536）。`TaskRoleSwitcherRow` は使用箇所が 1 つだけなので `TaskSidebarContent.tsx` 内 inline 維持。`shared/EditableTitle.tsx`（controlled input）と用途違いのため local fn を `InlineEditableHeading` に rename して名前衝突回避。外部 import (`TaskTreeView.tsx` / `ScheduleTasksContent.tsx`) は不変（path `./TaskDetail/TaskDetailPanel` を維持）。commit `661b370`。tsc -b 通過 / Vitest 257/257（pre-existing WIP stash 後）。**残り 2-3b/c/d は次セッション以降**: ScheduleTimeGrid (1220) / OneDaySchedule (1165) / TagGraphView (1443) — それぞれ 1 セッション + 手動 UI 検証必須
- リファクタリング Phase 1 完了（Cloud sync split / Provider tree 抽出 / row_to_json 統合 / SAFETY コメント）✅（2026-04-25）— 4 step 全完遂。**1-1**: `cloud/src/routes/sync.ts` 459 行を `routes/sync/{index,shared,versioned,relations}.ts` + `config/syncTables.ts` + `utils/schema.ts` の 6 ファイル分割。`buildStampStatement` で server_updated_at UPDATE の重複を解消。`PushBodySchema`(zod) で /sync/push body 検証。**1-1 security**: `middleware/auth.ts` の Bearer token 比較を `===` から SHA-256 + `crypto.subtle.timingSafeEqual` に置換（タイミング攻撃緩和）。SQL identifier 補間箇所すべてに `// SAFETY:` コメント。**1-2**: `frontend/src/main.tsx` 97→38 行、`providers/{DesktopProviders,MobileProviders}.tsx` に 16 層 Provider 木を移送（CLAUDE.md §6.2 の Mobile WikiTag 省略は実コード未実施で乖離あり、今回は既存挙動維持）。**1-3**: `src-tauri/src/db/row_converter.rs` 新設で `helpers.rs` / `sync_engine.rs` の重複 `row_to_json` を統合。**1-4**: `sync_engine.rs:94,100` の `format!("...{table}...")` に `// SAFETY: const slice 反復` コメント、`helpers::next_order` doc に「callers MUST pass static literals」契約を明記。`debug_assert!(is_known_table)` は構造的に冗長と判断し不採用。3 commits (599133e cloud / ecbc192 frontend / 63799a6 rust)。tsc -b 通過、cargo check --lib 通過、wrangler dry-run 199.95 KiB / 38.82 KiB gzip、Vitest 257/257（WIP stash 後の clean state で確認）
- リファクタリング Phase 0 完了（@deprecated 整理 / formatTime 統合 / tiptap XSS / MEMORY.md dedup）✅（2026-04-25）— 中粒度の subsystem 並列分析（Frontend / Rust / Cloud）から 4-Phase 計画を策定し Phase 0 を実行。`@deprecated` 4→0 件 / `ScheduleContextValue.ts` 削除 + `GroupFrame.onDoubleClick` / `UndoRedoButtons.domain` 削除 / `ScheduleItemEditPopup.tsx` の真の重複 formatTime を `utils/timeGridUtils` から import に統一（agent 推定 18+ 箇所は 4 シグネチャ責務違い並存で過剰検出と判明）/ `tiptapText.ts::getContentPreview` の innerHTML を `DOMParser.parseFromString` 化で `<img onerror>` 系 XSS 経路 inert 化 / §バグの温床 17→16 ユニーク項目。-58 行 / 7 ファイル変更 / 5 commits。tsc -b 通過 / Vitest 255 passed (31 files) / `@deprecated` grep 0 件。新規 doc: `.claude/2026-04-25-refactoring-plan.md` (IN_PROGRESS) + `docs/code-inventory.md`

## 予定

### リファクタリング計画 Phase 2-3（Phase 0/1/2-3a 完了済、IN_PROGRESS）

**対象**: `frontend/src/services/TauriDataService.ts` / `src-tauri/src/db/migrations.rs` / `src-tauri/src/db/*_repository.rs` 27 件 / 巨大コンポーネント 残 3 件 / Calendar Mobile-Desktop 統合 ほか
**計画書**: `.claude/2026-04-25-refactoring-plan.md` / `.claude/docs/code-inventory.md`
**Phase 2 残（4-5 セッション、推定 -1500〜-2500 行）**: `migrations.rs` 2328 行を V1-V30 / V31-V60 / V61-V64 の 3 分割（**WIP migrations.rs +103 行と衝突するため WIP コミット待ち**） / `TauriDataService.ts` 1453 行を domain ごとに分割（**WIP +30 行と衝突**） / 巨大コンポーネント 残 3 件（ScheduleTimeGrid 1220 / OneDaySchedule 1165 / TagGraphView 1443）を 1 セッション 1 ファイルで分割 + 手動 UI 検証必須 / Calendar Mobile-Desktop 統合（`useCalendarViewLogic` + `components/Calendar/shared/` 新設）
**Phase 3（6-10 セッション、推定 -2000〜-4000 行）**: Rust 27 repository の `row_to_model` 統一 trait 化 / Issue 012 cursor pagination 本実装（Worker `nextSince` + client while loop）/ `components/Schedule/` → `components/ScheduleList/` rename / `components/Schedule/ScheduleSection.tsx` と `MobileScheduleView.tsx` 統合 / 論理キー UNIQUE migration（tasks / dailies / notes / routines / `routine_tag_assignments` などへ V65+ partial UNIQUE）

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
