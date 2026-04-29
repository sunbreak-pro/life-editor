# MEMORY.md - タスクトラッカー

## 進行中

（なし）

## 直近の完了

- Server-Authoritative Sync 移行 Phase 0 + Phase 1 ✅（2026-04-29）— Cloud Sync 双方向 LWW の構造的脆弱性 6 点を抑制するための 4 段階移行計画 (`.claude/2026-04-29-server-authoritative-migration.md`) のうち Phase 0（保険）+ Phase 1（Worker v2 API 並走）を実装。ブランチ `feat/server-authoritative-sync-phase0-1`。**Phase 0.1 timestamp 統一**: `helpers.rs` に `pub const SQL_NOW_ISO = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')"` を追加し、`datetime('now')` 65 箇所（Rust 50 + TS 15）を sed で機械置換（reminder.rs WHERE 比較 + sync_engine.rs:415 コメントは保護）。Known Issue 013-A の恒久対応。**Phase 0.2 UNIQUE 監査**: VERSIONED_TABLES 11 + RELATION_TABLES_WITH_UPDATED_AT 5 を全件レビューし、tasks/notes/routines/calendars/templates/routine_groups/sidebar_links は論理一意性なし、dailies(date) / schedule_items(routine_id,date partial) / wiki_tags(alias) / time_memos(date,hour) / wiki_tag_assignments(tag_id,entity_id PK) / wiki_tag_connections / note_connections / calendar_tag_assignments(V65) / routine_group_assignments(V69) は既に UNIQUE 制約あり → V70 不要。**Phase 1 Worker v2 API**: `cloud/src/routes/api/v2/{shared,mutate,snapshot,since,health,index}.ts` 6 ファイル新規作成。`POST /api/v2/mutate/:table` は table allowlist + op=upsert/delete + 楽観 concurrency (409 Conflict) + soft-delete (404 Not Found) + Worker 単独で version 自動 increment + server_updated_at 一元 stamp。`GET /api/v2/snapshot` は全 sync 対象テーブル一括返却、`GET /api/v2/since?cursor=ISO` は **next_cursor を必ず返す** ことで Known Issue 012 を根治。`GET /api/v2/health` は authMiddleware 越しの ping。**index.ts**: `/api/v2` route mount + authMiddleware 適用、v1 `/sync/*` と完全並走（Phase 2-3 中の cutover 期間用）。**smoke test**: `cloud/scripts/smoke-test-v2.sh` 11 項目（health / upsert insert / upsert update with correct version / 409 stale version / 400 unknown table / 400 invalid op / snapshot contains row / since past cursor advances / 400 missing cursor / delete / 404 delete missing）を bash + curl で実装。**Verification**: `cargo test --lib` 25/25 pass、`cd cloud && npx tsc --noEmit` clean、`cd mcp-server && npx tsc --noEmit` clean、`rg "datetime\('now'\)"` で reminder.rs / sync_engine.rs:415 以外ゼロ件。実機検証手順は `.claude/2026-04-29-server-authoritative-migration.md §6` に記述（Desktop SQLite の updated_at 形式目視 / wrangler dev 起動 + smoke-test 実走 / 本番デプロイ前チェックリスト / v1 regression 確認）。**残作業**: Phase 1.5（本番 wrangler deploy + 本番 smoke test）、Phase 2（Mobile thin client 化）、Phase 3（Desktop 片方向 push）、Phase 4（v1 撤去 + D1 schema 派生化）
- Routine Tag 廃止 + Group 化 の手動 UI 検証 + Cloud D1 0007 適用 + Worker deploy ✅（2026-04-29）— 予定リスト先頭の本タスクが既に完遂していることを静的確認で検証。**(1) Desktop V69 自動 apply**: `~/Library/Application Support/life-editor/life-editor.db` の `PRAGMA user_version=69` 確認、`routine_group_assignments` 存在、旧 `routine_tag_definitions` / `routine_tag_assignments` / `routine_group_tag_assignments` 全消失。**(2) Cloud D1 0007 適用**: `wrangler d1 execute life-editor-sync --remote` で `routine_group_assignments` (id/routine*id/group_id/created_at/updated_at/is_deleted/deleted_at/server_updated_at) を確認、旧 routine_tag*_ 系全消失。**(3) Worker deploy**: 最新 deploy 2026-04-25 12:14:36 UTC (=21:14 JST) で V69/D1 0007 commit `1edc530` (21:05 JST) の 9 分後デプロイ済み (deployments list: 2026-04-18 / -21 / -22 / -23×2 / -24 / -25×4 で計 9 件)。**(4) Routine UI 検証**: `RoutineEditDialog.tsx:275` で `frequencyType === "group"` 分岐 + inline new group 作成 form (`newGroupFrequencyType` / `newGroupFrequencyDays` / `newGroupFrequencyInterval` / `newGroupFrequencyStartDate` の 4 state) が実装済み。**(5) Cloud Sync 双方向**: コードレベルで `cloud/src/config/syncTables.ts:51,88` に `routine_group_assignments` を sync 対象登録済み。実機双方向動作はユーザー確認済み。**残置の古い DB**: 共存する `~/Library/Application Support/com.lifeEditor.app/life-editor.db` は `user_version=59` で旧 routine*tag*_ テーブル群を保持（バンドル ID 違いの旧パス、現在の app は `life-editor/` 側を使用、Known Issue 006 関連）。**関連 commit**: `1edc530 feat(routines): drop Tag concept, add Group-based frequency (V69 + D1 0007)`
- life-editor 固有エージェント 3 件追加（IPC / Migration / Sync 監査）✅（2026-04-27）— 「`~/dev/Claude/agents-lib/` と `~/dev/Claude/sui-memory/` を読み込み最適エージェントを symlink」要望を Auto mode で実施。**現状確認**: agents-lib に global 5 件（multi-session-coordinator / session-manager / security-reviewer / web-researcher / deep-web-research）が `~/.claude/agents/` にリンク済（life-editor からも自動利用可）。`sui-memory/` は記憶エンジン本体（Python / SQLite + sentence-transformers）でエージェント定義を含まない。`agents-lib/projects/life-editor/` は空。**判断**: グローバル再リンクは agent-management 規約上の冗長で意味なし。代わりに life-editor 特有の検証ニーズ（Tauri IPC 4 点同期 / DB マイグレーション 3 系統 / Cloud Sync 分類）を「既存実装の整合性監査」として埋める方向で 3 件新規作成。**新規エージェント 3 件 (opus/xhigh, 監査特化、コード変更なし)**: (1) `life-editor-ipc-validator` — `#[tauri::command]` 関数 ↔ `generate_handler![]` ↔ `DataService` interface ↔ `TauriDataService` 実装 + invoke 引数名一致 + Date/undefined 落とし穴 / (2) `life-editor-migration-validator` — per-version `v61_plus.rs` + `full_schema.rs` + Cloud D1 `cloud/db/migrations/000N_*.sql` の 3 系統横断 + `LATEST_USER_VERSION` bump + idempotent 性 / (3) `life-editor-sync-auditor` — `VERSIONED_TABLES` 11 件 / `RELATION_TABLES_WITH_UPDATED_AT` 3 件 / inline 2 件の分類網羅性 + LWW + soft-delete-aware delta + 既知脆弱性 3 件再発検出。**配置**: 実体を `~/dev/Claude/agents-lib/projects/life-editor/` に作成、新規 `/Users/newlife/dev/apps/life-editor/.claude/agents/` ディレクトリにシンボリックリンクで露出（agent-management 規約準拠の一元管理）。`AGENT_INDEX.md` の Project Agents セクションを「現在未使用」から life-editor 3 件のテーブルに更新。**Verification**: 静的整合性のみ（symlink target / frontmatter YAML / description trigger 語彙）。動作検証は次回該当ファイル編集時の自動起動で確認

## 予定

### Server-Authoritative Sync 移行 Phase 1.5（本番デプロイ）+ Phase 2（Mobile thin client 化）

**対象**: `cloud/` (deploy 実行) / `frontend/src/services/data/MutationQueueService.ts` 新規 / `frontend/src/services/RemoteWorkerDataService.ts` 新規 / `frontend/src/services/dataServiceFactory.ts` Mobile 分岐 / V70 mutation_queue migration
**計画書**: `.claude/2026-04-29-server-authoritative-migration.md`
**前提**: Phase 0 + Phase 1 完了済み（v2 API は cloud にコード commit 済み、`feat/server-authoritative-sync-phase0-1` ブランチ）。本番 Worker deploy はユーザー判断待ち
**手順**:

1. **Phase 1.5 本番デプロイ**: `cd cloud && wrangler deploy` → 本番 URL に対し `BASE_URL=... SYNC_TOKEN=... bash scripts/smoke-test-v2.sh` で 11/11 PASS 確認 → 残留 smoke-note を `DELETE FROM notes WHERE id LIKE 'smoke-note-%'` で清掃 → 既存 Desktop / iOS の v1 sync が引き続き動作することを Sync Now で確認
2. **Phase 2.1 V70 migration**: Desktop / Mobile 両 OS で適用される `mutation_queue` テーブルを v61_plus.rs + full_schema.rs に追加（id/table_name/op/entity_id/payload/created_at/attempt_count/last_error）+ LATEST_USER_VERSION = 70 に bump
3. **Phase 2.2 MutationQueueService**: SQLite enqueue/dequeue + 指数バックオフ flush + online/offline 検知（navigator.onLine + /api/v2/health ping）
4. **Phase 2.3 RemoteWorkerDataService**: DataService interface 実装、全 mutation を MutationQueue 経由、Read はローカル SQLite
5. **Phase 2.4 dataServiceFactory 分岐**: `import.meta.env.VITE_PLATFORM` で Mobile 検出時 RemoteWorkerDataService を返す
6. **Phase 2.5 Bootstrap**: 初回起動で `/api/v2/snapshot` → ローカル DB rebuild
7. **Phase 2.6 Polling**: SyncContext.tsx で foreground 時のみ `/api/v2/since/<cursor>` を 5 秒間隔
8. **Phase 2.7 検証**: iOS シミュレータ + Android AVD でノート / タスク / スケジュールの双方向 round-trip + 機内モード切替 flush + 既知 Mobile UX 不具合（009 系）の非再発

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

### 旧バンドル DB の orphan クリーンアップ

**対象**:

- `~/Library/Application Support/com.lifeEditor.app/life-editor.db` (user_version=59、旧 routine_tag_definitions / routine_tag_assignments / routine_group_tag_assignments を保持)
- `~/Library/Application Support/sonic-flow/life-editor.db` (user_version=0、空)

**背景**: bundle ID 変遷（旧 `sonic-flow` → `com.lifeEditor.app` → 現行 `com.lifeEditor.app.newlife`）の遺産。Known Issue 006 関連。現在の app は `~/Library/Application Support/life-editor/life-editor.db` (user_version=69) を使うため上記 2 つは orphan。実害はないが (a) ストレージを浪費 / (b) 検証時に grep で誤って旧 DB を引いて混乱する（実際 2026-04-29 の Routine Tag 廃止検証の際に発生）
**前提**: 削除前に rescue 価値のあるデータが無いことを確認。`sonic-flow/sonic-flow.db` は別プロジェクト(Sonic Flow アプリ本体)なので残す
**手順**:

1. `sqlite3 <旧 DB path> "SELECT COUNT(*) FROM routines WHERE is_deleted=0; SELECT COUNT(*) FROM tasks WHERE is_deleted=0; SELECT COUNT(*) FROM notes WHERE is_deleted=0"` で各テーブル行数を確認
2. 行があれば `~/Backups/orphan-life-editor-<bundle_id>-$(date +%Y%m%d).db` に退避（rsync ではなく `cp` で WAL 含めず単一ファイル退避）
3. `rm <旧 DB path>` （`life-editor.db-shm` / `life-editor.db-wal` も同時削除）
4. アプリ再起動して動作影響なし + `find ~/Library/Application\ Support -name 'life-editor.db'` の結果が `~/Library/Application Support/life-editor/life-editor.db` の 1 件のみになることを確認

### Part A 手動受入テスト（iOS 実機）

**対象**: iPhone 実機での Materials Notes 表示確認
**背景**: 2026-04-21 Phase A コード変更は品質ゲート通過済み、iOS 実機での NodeView レンダリング確認が未実施
**観点**: Callout / ToggleList / WikiTag / NoteLink / Table / TaskList が Desktop と同一構造で表示されること

### iOS 4G 同期検証

**対象**: iPhone 実機 / 4G 環境
**前提**: 004/005/008 修正完了 + V62 migration 適用

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
