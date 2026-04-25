# MEMORY.md - タスクトラッカー

## 進行中

（なし）

## 直近の完了

- Work UX 補強 + V68 FREE CHECK バグ修正 ✅（2026-04-25）— **バグ修正**: Phase B で導入した Free session ボタンが `CHECK constraint failed: session_type IN ('WORK','BREAK','LONG_BREAK')` で起動不能だった (Phase B 計画書では「CHECK 制約は元々無し」と誤認していたが full_schema.rs に存在)。V68 migration で `timer_sessions` を `_v2` 経由 rebuild + CHECK に `'FREE'` 追加 (`sqlite_master.sql` から判定して冪等)、`full_schema.rs` の CHECK も新形式に同期、`LATEST_USER_VERSION = 68` バンプ + 統合テスト 2 件 (FREE accept / 既存行保持)。**A: Work History タブ**: `WorkHistoryContent.tsx` 新規 (直近 14 日の WORK / FREE セッションを日別グルーピング + 直近 7 日合計 + sessionType 色分け + task 名解決) を `WorkScreen.tsx` の Timer/Music の間に配置。**C: 完了 Toast**: `useSessionCompletionToast.ts` 新規 (`completedSessions` 増加 watch で `✓ Recorded {min}min to {task}` Toast、Strict Mode の double effect でも prevRef 書き戻しが冪等)、WorkScreen / MobileWorkView 両方で呼ぶ。**Sync 500 対処**: D1 の `calendar_tag_assignments` が旧 PK スキーマ (schedule_item_id, tag_id) のまま残っており新クライアントの新スキーマ push が 500 になっていた問題に対し、`cloud/db/migrations/0006_fix_cta_server_updated_at.sql` (0004 の rebuild 部分を独立化した修復用 migration) を作成 + `wrangler d1 execute --remote --file=./db/migrations/0004_calendar_tags_v65.sql` を実行 (changed_db: true / rows_written: 40)。**今セッションで完了**: SYNC_TOKEN ローテーション (`wrangler secret put`) で auth 復旧 → `npm run deploy` で Worker を 04-17 → 最新 (8 commits, auth timing-safe / sync routes split / Known Issues 011-014 修正) に最新化 → D1 migration 0003 / 0005 を追加適用 → `wrangler tail` で `D1_ERROR: no such column: server_updated_at at offset 63` 観測 → `pragma_table_info` 一括検証で sync 対象 15 テーブル中 `calendar_tag_assignments` のみ legacy schema 残存と特定 → 0006 を `wrangler d1 execute --remote` で適用、V65 shape (id PK + entity_type + entity_id + tag_id + updated_at + server_updated_at) に rebuild 完了。**Known Issue 候補**: 0004 が D1 transactional rollback 保証下にも関わらず部分適用された原因不明 (016 起票検討)。**残**: Desktop で Sync Now を実走、Last error 消失と双方向同期の確認**i18n**: `work.tabHistory` / `work.history.{last7Days,empty}` / `work.toast.{recordedToTask,recordedFreeWork}` を ja+en に追加。**検証**: cargo test 21 passed (1 ignored、新規 V68 統合テスト 2 件含む) / vitest 268 passed (新規 useSessionCompletionToast.test.ts 4 件含む) / tsc -b + cargo check 0 error / 変更ファイル ESLint 0 error。session-verifier 全 6 ゲート PASS
- Q2 機能パッチ Phase D + Phase A Cloud Sync 完了 ✅（2026-04-25）— 計画書 `2026-04-25-sidebar-tags-free-pomodoro.md` の全 Phase 完了 (archive へ移動)。**Phase A 残**: D1 migration 0004 で `calendar_tag_definitions` に Cloud Sync 列追加 + `calendar_tag_assignments` を新スキーマに rebuild、`syncTables.ts` で `calendar_tag_assignments` を `RELATION_TABLES_WITH_UPDATED_AT` に昇格（旧 `RELATION_PARENT_JOINS` の `schedule_items` 経由 JOIN を撤去、entity_type が task/schedule_item の二択で単一親 JOIN が一意でないため）。**Phase D**: V67 migration で `sidebar_links` テーブル新設 (id PK + kind('url'\|'app') + name + target + emoji + sort_order + version + LWW)、`sidebar_link_repository.rs` (CRUD + reorder, 5 unit test) / `sidebar_link_commands.rs` (5 IPC) / `system_commands.rs` 拡張で `system_list_browsers` (Chrome/Safari/Firefox/Edge/Arc/Brave を `/Applications` 存在チェックで列挙) + `system_list_applications` + `system_open_url(url, browserId?)` + `system_open_app(path)` を追加 (`#[cfg(target_os = "macos")]` で iOS は `Err` 返却) / Frontend は Pattern A 4 ファイル (`useSidebarLinks` + Context + Provider + Hook) + `SidebarLinkItem` (右クリックメニューで edit/delete) + `SidebarLinkAddDialog` (URL/App トグル + アプリ検索 + emoji) + LeftSidebar 統合 (mainMenu 下に「Links」セクション + ホバー `+` ボタン) / `BrowserSettings` 新規 (検出ブラウザのみラジオ表示、選択を `app_settings.default_browser` に保存、未インストール時は `null` fallback) / MobileApp Drawer に常時表示 (`kind='app'` はグレーアウト + Toast「iOS では起動できません」) / Cloud Sync は `cloud/db/migrations/0005_sidebar_links.sql` + `VERSIONED_TABLES` / `PRIMARY_KEYS` 追加 + `sync_engine.rs` の VERSIONED_TABLES / payload マッパに `sidebar_links` 統合 / DesktopProviders / MobileProviders / renderWithProviders に `SidebarLinksProvider` 配置 / i18n `sidebarLinks.*` (20 keys) + `settings.browser.*` (4 keys) を ja+en 両方に追加 / CLAUDE.md §2 Mobile 省略 Provider・§4.1 直近 migration (V67 / D1 0004 / D1 0005)・§6.2 Provider 順序を更新。**検証**: cargo test 19/19 (新規 v67_creates_sidebar_links_table + 5 sidebar_link_repository test) / vitest 264/264 (新規 useSidebarLinks.test.ts 7 test、optimistic UI ロールバック + 非インストール browser fallback もカバー) / tsc -b (frontend) 0 error / tsc --noEmit (cloud) 0 error。**Rollout 順序 (重要)**: D1 migration を Worker deploy より先に適用すること (逆順だと旧 schema に新 Worker が当たり sidebar_links / calendar_tag_assignments delta が 500)
- sync_engine V65 follow-up fix（calendar_tag_assignments delta query 修正）✅（2026-04-25）— /session-verifier Gate 3 で発見した sync_engine.rs テスト 2 件失敗を解消。Q2 patch (1847e4c) の V65 migration が `calendar_tag_assignments` を `(entity_type, entity_id, tag_id)` + 自身の `updated_at` 持ちに再構築したが、`sync_engine.rs::collect_local_changes` が旧スキーマの `cta.schedule_item_id` JOIN を保持していた。CTA 自身の `updated_at` を delta cursor とする query に書き換え（task-typed CTA も同時に拾えるよう JOIN 撤去）。`cargo test --lib sync::sync_engine` 2/2 pass、全体 11/13 → 13/13 pass。1 commit (`58609b3`)。**Cloud 側の同種修正は本セッションで完了**: `syncTables.ts` の `RELATION_PARENT_JOINS` から `calendar_tag_assignments` を削除、`RELATION_TABLES_WITH_UPDATED_AT` に昇格

## 予定

### Q2 機能パッチ Phase D / Phase A Cloud Sync の手動 UI 検証

**対象**: macOS app launch / 既定ブラウザ選択 / iOS Drawer 表示 / 双方向同期の動作確認
**前提**: D1 migration 0003/0004/0005/0006 全適用済 + Worker latest deploy 済 (2026-04-25 完了)
**手順**:

1. Desktop で Sync Now 実走 → `Last error` が消えて Connected 表示が維持されることを確認
2. Desktop V67 自動 apply 確認 → LeftSidebar に「Links」セクション表示 / `+` で URL/App リンク追加 / 既定ブラウザ切替で URL 起動先が変わる / `/Applications/*.app` 一覧から登録できる
3. iOS シミュレータ Drawer に `kind='app'` がグレーアウト + Toast 出ることを確認
4. Desktop ↔ iOS 双方向 sync で sidebar_links と calendar_tag_assignments が伝搬すること
5. **Known Issue 016 検討**: D1 0004 が transactional rollback 保証下にも関わらず `calendar_tag_assignments` rebuild 部分のみ未適用となった原因の調査・記録 (`docs/known-issues/_TEMPLATE.md` から起票)

### リファクタリング計画 Phase 2 残（Phase 0/1/2-1/2-3a 完了済、IN_PROGRESS）

**対象**: `frontend/src/services/TauriDataService.ts` / 巨大コンポーネント 残 3 件 / Calendar Mobile-Desktop 統合
**計画書**: `.claude/2026-04-25-refactoring-plan.md` / `.claude/docs/code-inventory.md`
**Phase 2 残（3-4 セッション、推定 -1500〜-2500 行）**: `TauriDataService.ts` 1481 行を domain ごとに分割（class → composition pattern の設計判断が必要、`dataServiceFactory.ts` 経由で `new TauriDataService()` 利用箇所のため refactor 影響範囲を要精査） / 巨大コンポーネント 残 3 件（ScheduleTimeGrid 1220 / OneDaySchedule 1165 / TagGraphView 1443）を 1 セッション 1 ファイルで分割 + 手動 UI 検証必須 / Calendar Mobile-Desktop 統合（`useCalendarViewLogic` + `components/Calendar/shared/` 新設）
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
