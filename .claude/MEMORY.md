# MEMORY.md - タスクトラッカー

## 進行中

（なし）

## 直近の完了

- iOS 追加機能要件 Phase 0〜4 / 6.1 / 6.3(Desktop) / 7 実装 + 品質ゲート ✅（2026-04-24 / 2026-04-25）— Note「iOS追加機能要件」16 項目のうち Global (G-1/G-3/G-5)・Materials M-5・Calendar C-1/C-3(Desktop)・Work W-1/W-2/W-3 を完遂。`MobileLayout` ヘッダーにハンバーガー + UndoRedoButtons、`MobileLeftDrawer` + `useSectionHistory` + `useEdgeSwipeBack` 新設、Phase 2.3-Redo で drawer=Desktop sidebar / main=DailyView/NotesView の 2 スロット構造に再構成。`DailyView`/`NotesView`/`WorkSidebarInfo` を Mobile 省略 Provider 向け Optional 化。UndoRedoContext に `setActiveEditor` 追加で Mobile ヘッダー Undo が TipTap 本文編集にも効くように、NotesView タイトル 500ms debounce で 1 文字 undo 量産を解消。`utils/tiptapText.ts` に `extractFirstHeading` 追加、`NoteTreeNode` 表示タイトルを本文先頭 heading 優先に。`MobileCalendarView` 月グリッド横スワイプ (60px threshold)、Desktop `CreateItemPopover` に Routine 追加。`timerReducer` `SET_SESSION_TYPE` で Long Break 再タップの start/stop ループ解消、`MobileWorkView` SessionTabs をトップバー右寄せ。Known Issue 015 として `notion-*-primary` サフィックス誤用 (Tailwind v4 は未定義 class silent skip) による Mobile 全体 27 箇所の背景透明化バグを発見・修正。2026-04-25 session-verifier で React Compiler 起因の lint error 4 件 (`screenLock?.unlock ?? (() => {})` の不安定参照、setState in effect、mount/unmount setTimeout pattern) を修正、`useEdgeSwipeBack` の listener 再登録を ref 化で回避、`tiptapText.test.ts` (13) / `sectionDomains.test.ts` (8) / `timerReducer.test.ts` SET_SESSION_TYPE (3) の計 24 テスト追加。プランファイル `~/.claude/plans/life-editor-note-ios-calm-moth.md`。tsc -b 通過 / Vitest 255 passed (31 files)。残: M-1 行スワイプ / M-2/M-3 TipTap slash / C-2 filter / Mobile 5-role form（次セッション）
- Cloud Sync 014 本命修正 — server*updated_at cursor 導入 ✅（2026-04-24）— delta sync の非単調 updated_at 問題（Mobile v=372/11:50 と Desktop v=228/13:30 の組で高 version 行が永久に pull されない構造バグ）を Option A で解消: Cloud D1 に migration 0003 で versioned 10 + relation-with-updated_at 3 テーブルへ `server_updated_at TEXT` 追加 + `idx*\*\_server_updated_at`13 本 + 既存 updated_at からの backfill。Worker`/sync/push`を 2 文方式（UPSERT + 常時`UPDATE SET server_updated_at = ?serverNow WHERE pk = ?`）に変更し、版 LWW で棄却された push でも cursor stamp は必ず進むよう保証。`/sync/changes`は versioned / relation-with-updated_at / 親 join 3 箇所を全て`WHERE datetime(server_updated_at) > datetime(?since)`に切替。Production D1 migration 適用済み（39 queries / 2174 rows backfilled / wiki_tag_assignments の updated_at NULL 14 行は`1970-01-01T00:00:00.000Z`sentinel で追加補修）+ Worker 再 deploy（Version`38987e73-677c-43e9-9fab-52cb0ea7ca49`）。014.md Fixed 化 + INDEX.md 集計修正 + db-conventions.md §3 全面書き換え + §9 完了済み履歴移動 + CLAUDE.md §4.1 に Cloud 専用列の注記追加。client (Rust/Frontend) は無変更で API 契約維持。cloud tsc 0 error
- Cloud Sync timestamp 整合性修正（Known Issues 013 / 014）+ DB 規約 vision 新設 ✅（2026-04-24）— Mobile → Desktop 同期不達を 3 層で解消: (1) `cloud/db/migrations/0002_rename_memos_to_dailies.sql` を Cloud schema 準拠に書き直し（note_links/paper_nodes 除去 + wiki_tag_assignments PK 衝突の 2 段回避）+ 本番適用、(2) sync delta query のスペース区切り vs ISO 8601 混在バグ（ASCII 順 space<T で同日行凍結）を `sync_engine.rs` / `cloud/src/routes/sync.ts` の全 delta query に `datetime()` 正規化を適用（013 Fixed + regression test 2 本）、(3) delta sync が updated_at 単調性に依存する構造的制約（Mobile 高 version 古 updated_at 行が pull 不能）を Full Re-sync 緊急弁で暫定対応し 014 Monitoring 起票。Worker 再 deploy（Version 04d24d88...）。並行して `docs/vision/db-conventions.md` 新設（timestamp / version / sync protocol / UPSERT / migration / multi-language write / 禁止事項 9 章）、CLAUDE.md / MEMORY.md / auto-memory / known-issues INDEX 全整合更新。cargo test 11→13 pass / tsc 0 / clippy 新規 warning 0

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
